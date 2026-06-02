/**
 * Pluggable token-bucket rate limiter.
 *
 * In-memory by default. When `REDIS_URL` is set, counters are stored in
 * Redis so that horizontal replicas share a global limit.
 */

import { logger } from "../logger";

export interface RateLimitDecision {
  allowed: boolean;
  remainingTokens: number;
  limit: number;
}

export interface RateLimiterLike {
  allowRequest(key: string): Promise<RateLimitDecision> | RateLimitDecision;
  backend: "memory" | "redis";
}

class MemoryTokenBucket implements RateLimiterLike {
  public readonly backend = "memory" as const;
  private buckets = new Map<string, { tokens: number; lastRefilled: number }>();
  constructor(private maxTokens = 45, private refillRate = 1.5) {}

  allowRequest(key: string): RateLimitDecision {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.maxTokens, lastRefilled: now };
    } else {
      const elapsedSec = (now - b.lastRefilled) / 1000;
      b.tokens = Math.min(this.maxTokens, b.tokens + elapsedSec * this.refillRate);
      b.lastRefilled = now;
    }
    if (b.tokens >= 1) {
      b.tokens -= 1;
      this.buckets.set(key, b);
      return { allowed: true, remainingTokens: Math.floor(b.tokens), limit: this.maxTokens };
    }
    this.buckets.set(key, b);
    return { allowed: false, remainingTokens: 0, limit: this.maxTokens };
  }
}

class RedisTokenBucket implements RateLimiterLike {
  public readonly backend = "redis" as const;
  constructor(
    private client: any,
    private maxTokens = 45,
    private refillRate = 1.5,
    private windowSec = 60,
  ) {}

  async allowRequest(key: string): Promise<RateLimitDecision> {
    const bucketKey = `rl:${key}`;
    try {
      const now = Date.now();
      const raw = await this.client.get(bucketKey);
      let tokens: number;
      let lastRefilled: number;
      if (!raw) {
        tokens = this.maxTokens;
        lastRefilled = now;
      } else {
        const parsed = JSON.parse(raw);
        const elapsedSec = (now - parsed.lastRefilled) / 1000;
        tokens = Math.min(this.maxTokens, parsed.tokens + elapsedSec * this.refillRate);
        lastRefilled = now;
      }
      if (tokens < 1) {
        await this.client.set(bucketKey, JSON.stringify({ tokens, lastRefilled }), { EX: this.windowSec });
        return { allowed: false, remainingTokens: 0, limit: this.maxTokens };
      }
      tokens -= 1;
      await this.client.set(bucketKey, JSON.stringify({ tokens, lastRefilled }), { EX: this.windowSec });
      return { allowed: true, remainingTokens: Math.floor(tokens), limit: this.maxTokens };
    } catch (err) {
      logger.warn("[RedisRateLimit] failure, allowing request:", err);
      return { allowed: true, remainingTokens: this.maxTokens, limit: this.maxTokens };
    }
  }
}

let limiterInstance: RateLimiterLike | null = null;

export async function getRateLimiter(maxTokens = 45, refillRate = 1.5): Promise<RateLimiterLike> {
  if (limiterInstance) return limiterInstance;
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createClient } = require("redis");
      const client = createClient({ url });
      client.on("error", (err: any) => logger.warn("[RedisRateLimit] client error:", err?.message));
      await client.connect();
      limiterInstance = new RedisTokenBucket(client, maxTokens, refillRate);
      logger.info("[RateLimit] Redis backend connected");
      return limiterInstance;
    } catch (err) {
      logger.warn("[RateLimit] Redis unavailable, using in-memory:", err);
    }
  }
  limiterInstance = new MemoryTokenBucket(maxTokens, refillRate);
  return limiterInstance;
}
