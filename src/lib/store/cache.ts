/**
 * Pluggable response cache.
 *
 * Defaults to a process-local LRU with TTL and a janitor. When `REDIS_URL`
 * is set in the environment the cache is transparently backed by Redis so
 * that multiple server instances share state. The Redis client is loaded
 * dynamically; the dependency is optional.
 */

import { logger } from "../logger";

export interface CacheStats {
  totalItems: number;
  maxItems: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  backend: "memory" | "redis";
}

export interface ResponseCacheLike {
  get(key: string): Promise<any> | any;
  set(key: string, data: any): Promise<void> | void;
  getStats(): CacheStats;
}

class MemoryResponseCache implements ResponseCacheLike {
  private cache = new Map<string, { data: any; timestamp: number; accesses: number }>();
  private maxItems = 500;
  private maxAgeMs = 1000 * 60 * 60 * 2; // 2 hours
  public hits = 0;
  public misses = 0;
  public evictions = 0;

  constructor() {
    setInterval(() => this.runJanitor(), 1000 * 60 * 10).unref?.();
  }

  get(key: string) {
    const item = this.cache.get(key);
    if (item) {
      if (Date.now() - item.timestamp > this.maxAgeMs) {
        this.cache.delete(key);
        this.misses++;
        return null;
      }
      item.timestamp = Date.now();
      item.accesses++;
      this.hits++;
      return item.data;
    }
    this.misses++;
    return null;
  }

  set(key: string, data: any) {
    if (this.cache.size >= this.maxItems) {
      let oldestKey = "";
      let oldestTime = Infinity;
      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.evictions++;
      }
    }
    this.cache.set(key, { data, timestamp: Date.now(), accesses: 1 });
  }

  private runJanitor() {
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (now - v.timestamp > this.maxAgeMs) {
        this.cache.delete(k);
        this.evictions++;
      }
    }
  }

  getStats(): CacheStats {
    const tot = this.hits + this.misses;
    return {
      totalItems: this.cache.size,
      maxItems: this.maxItems,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: tot > 0 ? (this.hits / tot) * 100 : 0,
      backend: "memory",
    };
  }
}

class RedisResponseCache implements ResponseCacheLike {
  public hits = 0;
  public misses = 0;
  public evictions = 0;
  private maxAgeSeconds = 60 * 60 * 2;
  private client: any;

  constructor(client: any) {
    this.client = client;
  }

  async get(key: string) {
    try {
      const raw = await this.client.get(`cache:${key}`);
      if (!raw) {
        this.misses++;
        return null;
      }
      this.hits++;
      return JSON.parse(raw);
    } catch (err) {
      logger.warn("[RedisCache] get failed:", err);
      this.misses++;
      return null;
    }
  }

  async set(key: string, data: any) {
    try {
      await this.client.set(`cache:${key}`, JSON.stringify(data), { EX: this.maxAgeSeconds });
    } catch (err) {
      logger.warn("[RedisCache] set failed:", err);
    }
  }

  getStats(): CacheStats {
    const tot = this.hits + this.misses;
    return {
      totalItems: -1, // unknown without SCAN
      maxItems: -1,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: tot > 0 ? (this.hits / tot) * 100 : 0,
      backend: "redis",
    };
  }
}

let cacheInstance: ResponseCacheLike | null = null;

export async function getResponseCache(): Promise<ResponseCacheLike> {
  if (cacheInstance) return cacheInstance;
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createClient } = require("redis");
      const client = createClient({ url });
      client.on("error", (err: any) => logger.warn("[RedisCache] client error:", err?.message));
      await client.connect();
      cacheInstance = new RedisResponseCache(client);
      logger.info("[Cache] Redis backend connected for response cache");
      return cacheInstance;
    } catch (err) {
      logger.warn("[Cache] Redis unavailable, falling back to memory:", err);
    }
  }
  cacheInstance = new MemoryResponseCache();
  return cacheInstance;
}
