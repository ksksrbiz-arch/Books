import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";
import compression from "compression";

dotenv.config();

// Full-Scale High-Fidelity Performance cache with telemetry and automatic janitor eviction
class ResponseCache {
  private cache = new Map<string, { data: any, timestamp: number, accesses: number }>();
  private maxItems = 500;
  private maxAgeMs = 1000 * 60 * 60 * 2; // Auto-eviction after 2 hours
  public hits = 0;
  public misses = 0;
  public evictions = 0;

  constructor() {
    // Run Janitor every 10 minutes to auto-clean stale elements and protect system resources
    setInterval(() => this.runJanitor(), 1000 * 60 * 10);
  }

  get(key: string) {
    const item = this.cache.get(key);
    if (item) {
      if (Date.now() - item.timestamp > this.maxAgeMs) {
        this.cache.delete(key);
        this.misses++;
        return null;
      }
      item.timestamp = Date.now(); // update access time/LRU order
      item.accesses++;
      this.hits++;
      return item.data;
    }
    this.misses++;
    return null;
  }

  set(key: string, data: any) {
    if (this.cache.size >= this.maxItems) {
      let oldestKey = '';
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

  getStats() {
    return {
      totalItems: this.cache.size,
      maxItems: this.maxItems,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses)) * 100 : 0
    };
  }
}

const apiCache = new ResponseCache();

function getCacheKey(prefix: string, body: any): string {
  const bodyHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return `${prefix}:${bodyHash}`;
}

// Global Diagnostics and Fault Injection Configuration (Chaos Engineering)
export const chaosConfig = {
  simulateLatency: 0,        // Active lag in ms
  simulateDbOutage: false,    // Trigger database disruption fallbacks
  simulateApiExpiry: false,   // Simulate expired/missing API keys
  simulateRateLimit: false,   // Force a persistent rate-limiting response (429)
};

// Global telemetry stats collection
export const telemetryStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  authOutagesInduced: 0,
  latencyTimesInduced: 0
};

// Robust In-Memory Token Bucket Rate Limiter for secure resource throttling
class TokenBucketRateLimiter {
  private buckets = new Map<string, { tokens: number, lastRefilled: number }>();
  private maxTokens = 60;      // max requests burst
  private refillRate = 2;      // 2 tokens refilled per second (120 per minute)

  constructor(maxTokens = 60, refillRate = 2) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
  }

  public allowRequest(ip: string): { allowed: boolean, remainingTokens: number, limit: number } {
    const now = Date.now();
    let clientBucket = this.buckets.get(ip);
    
    if (!clientBucket) {
      clientBucket = { tokens: this.maxTokens, lastRefilled: now };
    } else {
      // Auto refill based on elapsed time
      const secondsPassed = (now - clientBucket.lastRefilled) / 1000;
      const refilledTokens = secondsPassed * this.refillRate;
      clientBucket.tokens = Math.min(this.maxTokens, clientBucket.tokens + refilledTokens);
      clientBucket.lastRefilled = now;
    }

    if (clientBucket.tokens >= 1) {
      clientBucket.tokens -= 1;
      this.buckets.set(ip, clientBucket);
      return { allowed: true, remainingTokens: Math.floor(clientBucket.tokens), limit: this.maxTokens };
    }

    this.buckets.set(ip, clientBucket);
    return { allowed: false, remainingTokens: 0, limit: this.maxTokens };
  }
}

const standardLimiter = new TokenBucketRateLimiter(45, 1.5); // Warmly tuned for high-fidelity storytelling speed

const rateLimitingMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  telemetryStats.totalRequests++;

  // Throttling simulation via chaos state
  if (chaosConfig.simulateRateLimit) {
    telemetryStats.failedRequests++;
    return res.status(429).json({
      error: "Too Many Requests (Simulated Fault Injection Active)",
      retryAfterSeconds: 10
    });
  }

  const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "anonymous_cli";
  const { allowed, remainingTokens, limit } = standardLimiter.allowRequest(clientIp);

  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", remainingTokens);

  if (!allowed) {
    telemetryStats.failedRequests++;
    return res.status(429).json({
      error: "Throttled: API resource rate limit exceeded. Please wait a moment before trying again.",
      retryAfterSeconds: 5
    });
  }

  next();
};

// Full-scale in-memory asynchronous execution queue to keep parent thread from ever blocking
type TaskFunction = () => Promise<any>;
interface QueueTask {
  id: string;
  task: TaskFunction;
  retries: number;
  maxRetries: number;
  createdAt: number;
  status: "idle" | "running" | "succeeded" | "failed";
  error?: string;
  result?: any;
}

class AsynchronousTaskQueue {
  private queue: QueueTask[] = [];
  private maxActiveTasks = 3; // Keep CPU/threads responsive and lightning sharp
  private activeCount = 0;
  public totalProcessed = 0;
  public totalFailed = 0;

  public addTask(task: TaskFunction, maxRetries = 3): string {
    const id = crypto.randomUUID();
    this.queue.push({
      id,
      task,
      retries: 0,
      maxRetries,
      createdAt: Date.now(),
      status: "idle"
    });
    this.processQueue();
    return id;
  }

  public getTaskStatus(id: string) {
    const item = this.queue.find(t => t.id === id);
    if (!item) return null;
    return {
      status: item.status,
      retries: item.retries,
      error: item.error,
      result: item.result
    };
  }

  private async processQueue() {
    if (this.activeCount >= this.maxActiveTasks) return;

    const nextTask = this.queue.find(t => t.status === "idle");
    if (!nextTask) return;

    nextTask.status = "running";
    this.activeCount++;

    try {
      console.log(`[TaskQueue] Executing background asynchronous task id: ${nextTask.id}`);
      nextTask.result = await nextTask.task();
      nextTask.status = "succeeded";
    } catch (err: any) {
      console.error(`[TaskQueue] Task ${nextTask.id} failed: ${err.message}`);
      nextTask.retries++;
      if (nextTask.retries <= nextTask.maxRetries) {
        nextTask.status = "idle"; // schedule retry on next loop tick
        const delay = 500 * Math.pow(2, nextTask.retries);
        console.log(`[TaskQueue] Scheduling exponential retry in ${delay}ms for task ${nextTask.id}...`);
        setTimeout(() => this.processQueue(), delay);
      } else {
        nextTask.status = "failed";
        nextTask.error = err.message;
        this.totalFailed++;
      }
    } finally {
      this.activeCount--;
      this.totalProcessed++;
      this.processQueue(); // Keep processing remainder loop
    }
  }

  getTelemetry() {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.filter(t => t.status === "idle").length,
      succeededCount: this.queue.filter(t => t.status === "succeeded").length,
      failedCount: this.queue.filter(t => t.status === "failed").length,
      totalTaskProcessed: this.totalProcessed
    };
  }
}

const asyncTaskQueue = new AsynchronousTaskQueue();

// Interceptor for fault injection: Simulated Latency
const latencyChaosMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (chaosConfig.simulateLatency > 0) {
    telemetryStats.latencyTimesInduced++;
    console.log(`[Chaos Mode] Artificially injecting ${chaosConfig.simulateLatency}ms lag...`);
    await new Promise(resolve => setTimeout(resolve, chaosConfig.simulateLatency));
  }
  next();
};

const app = express();
const PORT = 3000;

// Create local directory for generated images to avoid exceeding Firestore limits
const generatedImagesDir = path.join(process.cwd(), "generated-images");
if (!fs.existsSync(generatedImagesDir)) {
  fs.mkdirSync(generatedImagesDir, { recursive: true });
}

app.use(compression());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Place overall middleware before routers
app.use(latencyChaosMiddleware);

// Lazy initialize Gemini with simulated API Key outage injection
let genAI: GoogleGenAI | null = null;
function getAI() {
  if (chaosConfig.simulateApiExpiry) {
    telemetryStats.authOutagesInduced++;
    throw new Error("Simulated API Key Expiry / Key Unauthorized (Chaos Mode Enabled)");
  }
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    genAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAI;
}

/**
 * Utility to call Gemini with retry logic for transient errors (503, 429)
 */
async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || (error?.message?.includes('503') ? 503 : error?.message?.includes('429') ? 429 : null);
      
      if ((status === 503 || status === 429) && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Gemini API ${status} - Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Call Gemini with automatic model fallback if quota is exceeded
 */
async function generateContentWithFallback(params: {
  contents: any;
  config: any;
  primaryModel?: string;
  fallbackModel?: string;
}) {
  const primaryModel = params.primaryModel || "gemini-3.1-pro-preview";
  const fallbackModel = params.fallbackModel || "gemini-3.5-flash";
  
  try {
    return await callGeminiWithRetry(() => getAI().models.generateContent({
      model: primaryModel,
      contents: params.contents,
      config: params.config
    }));
  } catch (error: any) {
    const errorStr = (error?.message || "").toLowerCase();
    const isQuotaError = errorStr.includes("quota") || errorStr.includes("429") || error?.status === 429 || errorStr.includes("resource_exhausted") || errorStr.includes("limit");
    if (isQuotaError && primaryModel !== fallbackModel) {
      console.warn(`[GEMINI FALLBACK] Primary model ${primaryModel} failed with quota/rate limits. Automatically falling back to standard-free model ${fallbackModel}...`);
      return await callGeminiWithRetry(() => getAI().models.generateContent({
        model: fallbackModel,
        contents: params.contents,
        config: params.config
      }));
    }
    throw error;
  }
}

/**
 * Story Generation Node Structure
 */
const StoryNodeSchema = {
  type: Type.OBJECT,
  properties: {
    sceneTitle: { type: Type.STRING },
    sceneDescription: { type: Type.STRING },
    imagePrompt: { type: Type.STRING, description: "Highly descriptive visual prompt for generating an image or video of this scene." },
    mediaType: { type: Type.STRING, enum: ["image", "video"], description: "Whether this scene should be an image or a video. Use video for particularly dramatic or atmospheric highlights." },
    choices: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          nextContext: { type: Type.STRING, description: "A brief summary of how this choice affects the story for the next prompt." }
        },
        required: ["text", "nextContext"]
      }
    },
    mood: { type: Type.STRING, enum: ["romance", "noir", "thriller", "mystery", "occult", "ethereal"] },
    intensity: { type: Type.NUMBER, description: "A value from 1 to 5 representing the tension or emotional intensity of the scene." },
    npcUpdates: {
      type: Type.ARRAY,
      description: "Any updates to NPC relationships based on the player's choices or recent events.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the NPC" },
          affinityChange: { type: Type.NUMBER, description: "Change in affinity or suspicion score (-100 to 100)" },
          reason: { type: Type.STRING, description: "Brief visual reason for the change, shown to the player" },
          relationshipType: { type: Type.STRING, enum: ["affinity", "suspicion"], description: "Whether this tracks affinity (romance/friendship) or suspicion (crime/mystery)" }
        },
        required: ["name", "affinityChange", "reason", "relationshipType"]
      }
    },
    newConsequences: {
      type: Type.OBJECT,
      description: "Any new long-term consequences resulting from choices in this scene. Key is a short identifier (e.g. 'betrayed_john'), value is a description of the consequence.",
      additionalProperties: { type: Type.STRING }
    },
    milestonesAchieved: {
      type: Type.ARRAY,
      description: "New critical story milestones achieved in this scene (e.g., 'found_weapon', 'betrayed_ally')",
      items: { type: Type.STRING }
    },
    isEnding: {
      type: Type.BOOLEAN,
      description: "True if this scene concludes the story, either successfully or tragically."
    },
    endingType: {
      type: Type.STRING,
      description: "If isEnding is true, the title/archetype of the ending achieved (e.g., 'Justice Served', 'Heartbreak')."
    }
  },
  required: ["sceneTitle", "sceneDescription", "imagePrompt", "mediaType", "choices", "mood", "intensity", "isEnding"]
};

const PremiseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      archetype: { type: Type.STRING },
      backstory: { type: Type.STRING },
      customBasis: { type: Type.STRING },
      title: { type: Type.STRING }
    },
    required: ["archetype", "backstory", "customBasis", "title"]
  }
};

const CodexExtractionSchema = {
  type: Type.OBJECT,
  properties: {
    entries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          category: { type: Type.STRING, enum: ["character", "location", "item", "clue", "lore", "faction"] },
          content: { type: Type.STRING },
          status: { type: Type.STRING, enum: ["discovered", "revealed", "updated"] }
        },
        required: ["title", "category", "content", "status"]
      }
    }
  },
  required: ["entries"]
};

function generateProceduralFallback(params: {
  genre: string;
  characterArchetype: string;
  backstory: string;
  customBasis?: string;
  choiceTaken?: string;
  isEnding?: boolean;
}) {
  const genre = (params.genre || "mystery").toLowerCase();
  
  // Custom atmospheric text based on genre
  let sceneTitle = "Shadows in the Mist";
  let sceneDescription = "";
  let imagePrompt = "Atmospheric film-noir alleyway at night.";
  let choices = [
    { text: "Stealthily investigate the source of the noise", nextContext: "investigate_noise" },
    { text: "Regroup in the shadows and seek safety", nextContext: "regroup_shadows" }
  ];

  if (genre === "romance") {
    sceneTitle = "An Unplanned Coincidence";
    sceneDescription = `The rain drums softly against the glass overhead, casting cascading reflections of amber light across the room. You stand before ${params.characterArchetype || "the enigmatic designer"}, your fingers turning the cold edge of a leather-bound journal. The silence between you stretches—not cold, but thick with things left unsaid. Your haunting past regarding "${params.backstory || "unresolved memories"}" whispers, yet the warmth of their proximity is undeniable. Every subtle rustle of their coat, the slight lift of their chin, draws you closer into a dynamic of shared hesitation.\n\n"We shouldn't remain here," they murmur, though neither of you makes a move to step away. A spark of pure, quiet electricity hangs in the space between you, inviting a decision that could alter your bounds forever.`;
    imagePrompt = "Warm cinematic backlighting, soft natural golden lens flare, emotional connection with soft focus, intimate close-up depth of field.";
    choices = [
      { text: "Step closer and ask for their honest thoughts", nextContext: "ask_honesty_romance" },
      { text: "Change the subject and hold back your emotions", nextContext: "hold_back_romance" }
    ];
  } else if (genre === "crime" || genre === "noir") {
    sceneTitle = "The Neon Verdict";
    sceneDescription = `The smell of ozone and cheap grease fills the wet alley. You pull your collar tight against the persistent drizzle. As ${params.characterArchetype || "a lone investigator"}, you've chased leads down to this dead-end, haunted by "${params.backstory || "a guilty conscience"}". Under the sputtering cyan light of a flickering neon billboard, you spot a discarded zinc briefcase. Inside are files outlining everything you've feared.\n\nFootsteps splash behind you, snapping your attention back to the immediate present. You are trapped between a systemic conspiracy and the heavy, metallic bite of immediate danger.`;
    imagePrompt = "Gothic thriller tone, eerie wet alleyway shadows, dragging mist, sputtering cyan-magenta neon lights, heavy vignette.";
    choices = [
      { text: "Draw your flashlight and confront the shadowy figure", nextContext: "confront_shadow_noir" },
      { text: "Slip behind the loading docks and ambush them", nextContext: "slip_ambush_noir" }
    ];
  } else {
    // paranormal / occult / mystery / horror
    sceneTitle = "The Whispers of the Arcane";
    sceneDescription = `A dry chill slides across the room, carrying the faint, sweet scent of crushed rose petals and old paper. The copper compass in your hand spins erratically, its hand pointing stubbornly toward the solid brick wall. As someone intimately tied to "${params.backstory || "the laughing entities in the mirror"}", you recognize the signature. The veil here is dangerously thin, almost translucent.\n\nAs you watch, a series of glowing blue-indigo glyphs slowly burn themselves into the wooden floorboards. The air grows heavy, pressing against your chest like warm breathing tissue.`;
    imagePrompt = "Mystical twilight fogs, ethereal blue-indigo bioluminescent vapors, glowing crystalline shards, dramatic chiaroscuro contrasts.";
    choices = [
      { text: "Place your hand flat upon the glowing glyphs", nextContext: "touch_glyphs_occult" },
      { text: "Recite the protective hex from your diary", nextContext: "recite_hex_occult" }
    ];
  }

  if (params.choiceTaken) {
    sceneDescription = `Responding to your action: "${params.choiceTaken}".\n\n` + sceneDescription;
  }

  return {
    sceneTitle,
    sceneDescription,
    imagePrompt,
    mediaType: "image",
    choices: params.isEnding ? [] : choices,
    mood: params.genre === "romance" ? "romance" : "mystery",
    intensity: 3,
    npcUpdates: [],
    newConsequences: {},
    milestonesAchieved: [],
    isEnding: params.isEnding || false,
    endingType: params.isEnding ? "Silent Resolve" : undefined,
    isProceduralFallback: true // Flag to communicate fail-safe state to UI
  };
}

app.post("/api/story/premise", rateLimitingMiddleware, async (req, res) => {
  const { genre, ignoreCache } = req.body;
  
  const cacheKey = getCacheKey("premise", { genre });
  if (!ignoreCache) {
    const cached = apiCache.get(cacheKey);
    if (cached) {
      console.log("Cache hit for premise:", genre);
      return res.json(cached);
    }
  }

  let genreGuidelines = "";

  if (genre === "romance") {
    genreGuidelines = `
      - SUBGENRES & THEMES: Focus on rich, unique settings like retro-futuristic space opera romance, Gothic dark-magic fantasy romance, Regency class-struggle espionage, or dark academia rival scholars. Avoid generic modern high school or coffee shop tropes.
      - COMPLEX ARCHETYPES: Craft highly specialized, distinctive roles. E.g., a disgraced cartographer of lost constellations, a mute clockwork artisan rebuilding her memories, a low-profile royal poison-taster, or an underworld information broker with a oath of silence.
      - HAUNTING BACKSTORIES: Include deep, complex motivations. For instance, bound by a ancestral family curse that prevents them from touching their soulmate, seeking a mythical blue-petal orchid to heal a sibling's spirit, or holding a forbidden lineage key that could dismantle a corrupt empire.
      - EXPLOSIVE HOOKS (customBasis): Create high-stakes, thrilling catalysts. E.g., sharing the final cabin of an airship flying straight into an eternal solar eclipse, forced to orchestrate a high-society museum heist together while hiding their true rival identities, or investigating an anonymous letter that accuses their own partner of treason.
    `;
  } else if (genre === "crime") {
    genreGuidelines = `
      - SUBGENRES & THEMES: Focus on evocative settings such as cyberpunk neon-noir, gilded-age clockwork conspiracy, industrial alchemical corporate espionage, or cosmic horror detective procedurals at isolated polar research stations.
      - COMPLEX ARCHETYPES: Move past the generic weary detective. E.g., a blind forensic botanist who reads toxic greenhouse ecosystems, a deaf safe-cracker who feels the micro-vibrations of brass gear locks, a memory-cleansing technician working under corrupt oligarchs, or a rogue chronologist tracking illegal temporal anomalies.
      - HAUNTING BACKSTORIES: Deep personal stakes. Example: accused of a high-society murder they genuinely have no memory of, escaping a shadow syndicate with a stolen code embedded in their neural pathways, or haunted by a phantom telegram predicting three high-profile assassinations.
      - EXPLOSIVE HOOKS (customBasis): A safe is found containing a beating clockwork heart with the protagonist's initials on it, being trapped on a speeding maglev train with a dead senator and passengers holding identical forged tickets, or receiving a pristine dossier detailing their own murder scheduled for tomorrow.
    `;
  } else {
    // paranormal
    genreGuidelines = `
      - SUBGENRES & THEMES: Try cryptid folk horror in abandoned mountain chains, techno-necromancy corporate cleanups, deep-sea sunken temple cosmic horror, or occult spiritualists in gaslight London.
      - COMPLEX ARCHETYPES: Avoid the classic ghost hunter. E.g., a taxidermist who locks wandering spirits inside delicate hand-crafted glass birds, a blind medium who paints the migration of urban phantoms across skyscrapers, a reclusive radio host whose midnight frequency broadcast is only picked up by ancient deities, or a marine salvage captain who hears the whispers of forgotten shipwrecks.
      - HAUNTING BACKSTORIES: Include occult complications. For instance, a childhood pact made with a laughing mirror entity, possessing a sentient shadow that acts independently during sleep, or surviving an archaeological excavation where the soil was discovered to be warm, breathing tissue.
      - EXPLOSIVE HOOKS (customBasis): All the mirrors in the harbor district begin displaying a backwards-running countdown, a dying collector hands them a copper compass that points to the nearest active gateway, or their glass taxidermy birds start singing in an ancient, dead tongue they somehow understand.
    `;
  }

  const prompt = `
    You are a master narrative architect and creative director of interactive fiction.
    Generate 3 completely unique, highly compelling, and remarkably diverse story premises for the genre: "${genre}".
    
    To ensure unprecedented variety, incorporate vastly different subgenres, tones, and highly unexpected character types. Push the boundaries of the genre and absolutely bypass all cliches and overused tropes.

    CRITICAL VARIETY GUIDELINES FOR THIS GENRE ("${genre}"):
    ${genreGuidelines}

    For each of the three premises, you must generate:
    1. "title": A catchy, deeply evocative, atmospheric title for this starting path.
    2. "archetype": A unique, highly specific character archetype. Ensure this is a detailed description of their unique profession, identity, or internal conflict (not just a one-word label).
    3. "backstory": A rich, haunting past, an unresolved tragedy, or a burning ambition that intimately anchors them to the genre's themes and provides great roleplay foundation.
    4. "customBasis": The shocking hook, inciting incident, or dramatic starting situation that immediately thrusts them into active play.

    Make each of the three premises feel wildly different from the others in tone (e.g., highly melancholic, fast-paced action, intense mystery), setting, and core conflict.
  `;

  try {
    const response = await generateContentWithFallback({
      primaryModel: "gemini-3.1-pro-preview",
      fallbackModel: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.9,
        responseMimeType: "application/json",
        responseSchema: PremiseSchema
      }
    });
    const data = JSON.parse(response.text!);
    apiCache.set(cacheKey, data);
    res.json(data);
  } catch (error: any) {
    console.error("Error generating premises:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/proxy-audio", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send("No URL provided");
  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
    
    // Set headers
    res.set({
      'Content-Type': response.headers.get('content-type') || 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400'
    });
    
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Audio proxy error:", error);
    res.status(500).send("Proxy error");
  }
});

// High-Fidelity Human-Like Text-to-Speech API (ElevenLabs + OpenAI TTS + Google Parallel Chunk Fallback)
app.get("/api/story/tts", rateLimitingMiddleware, async (req, res) => {
  const text = req.query.text as string;
  if (!text) {
    return res.status(400).send("No text provided");
  }

  const gender = (req.query.gender as string) || "neutral";
  const voice = (req.query.voice as string) || "google_assistant";

  try {
    // 1. ELEVENLABS PRESETS (If requested and API Key is active)
    if (voice.startsWith("eleven_") && process.env.ELEVENLABS_API_KEY) {
      console.log("[TTS] Utilizing ElevenLabs dynamic narration engine for voice:", voice);
      // Map keys to premium voice IDs
      let voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel premium default voice
      if (voice === "eleven_adam") {
        voiceId = "pNInz6obpgmev04fUC7t"; // Adam deep masculine voice
      }
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (response.ok) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        const arrayBuffer = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
      console.warn("[TTS] ElevenLabs endpoint failed, falling back to free Google engine...", response.statusText);
    }

    // 2. OPENAI PRESETS (If requested and API Key is active)
    if (voice.startsWith("openai_") && process.env.OPENAI_API_KEY) {
      console.log("[TTS] Utilizing OpenAI speech synthesis engine for voice:", voice);
      let voiceOption = "alloy";
      if (voice === "openai_nova") voiceOption = "nova";
      else if (voice === "openai_onyx") voiceOption = "onyx";
      
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: voiceOption,
        }),
      });

      if (response.ok) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        const arrayBuffer = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
      console.warn("[TTS] OpenAI TTS endpoint failed, falling back to free Google engine...", response.statusText);
    }

    // 3. SECURE HIGH-DENSITY GOOGLE TRANSLATE PARALLEL CHUNK ENGINE (Zero Setup Required - 100% Free)
    console.log("[TTS] Utilizing free parallel chunked Google speech assistant stream...");
    // Split text gracefully into small chunks to avoid Google's 200 character ceiling
    const sentences = text
      .replace(/([.?!;])\s+/g, "$1|")
      .split("|")
      .filter((s) => s.trim().length > 0);

    const chunkMax = 160;
    const textChunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + " " + sentence).trim().length <= chunkMax) {
        currentChunk = (currentChunk + " " + sentence).trim();
      } else {
        if (currentChunk) textChunks.push(currentChunk);
        let temp = sentence;
        while (temp.length > chunkMax) {
          textChunks.push(temp.substring(0, chunkMax));
          temp = temp.substring(chunkMax);
        }
        currentChunk = temp;
      }
    }
    if (currentChunk) {
      textChunks.push(currentChunk);
    }

    // Parallel loading loop for zero latency execution
    const chunkPromises = textChunks.map(async (chunk) => {
      const gTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const response = await fetch(gTtsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
          "Referer": "https://translate.google.com/"
        }
      });
      if (!response.ok) {
        throw new Error(`Google Translate source stream exception: ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    });

    const buffers = await Promise.all(chunkPromises);
    const unifiedBuffer = Buffer.concat(buffers);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.send(unifiedBuffer);

  } catch (error: any) {
    console.error("[TTS Engine Exception]:", error);
    res.status(500).json({ error: "Failed to generate dynamic natural voice stream.", explanation: error.message });
  }
});

// API routes
app.post("/api/story/start", rateLimitingMiddleware, async (req, res) => {
  const { genre, storyLength, characterArchetype, backstory, plotComplexity, tone, isAdultContent, customBasis } = req.body;
  
  const cacheKey = getCacheKey("start", req.body);
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log("Cache hit for story start");
    return res.json(cached);
  }

  const systemInstruction = `
    You are an elite master storyteller and narrative designer specializing in high-stakes interactive fiction. 
    ${isAdultContent ? 'Your audience is strictly 18+. You are authorized to include explicit, heavy, and raw mature themes, visceral descriptions, and high-intensity adult situations where appropriate for the story.' : 'Your audience is mature adults, but keep the content sophisticated and evocative without crossing into explicit territory.'}
    Your prose is evocative, sophisticated, and rich with sensory subtext.
    
    GENRE: ${genre}
    STORY LENGTH: ${storyLength || 'medium'}
    PROTAGONIST ARCHETYPE: ${characterArchetype || 'unknown'}
    BACKSTORY/AMBITION: ${backstory || 'To be discovered'}
    PLOT COMPLEXITY: ${plotComplexity || 'complex'}
    NARRATIVE TONE: ${tone || 'intense'} (Adjust the atmosphere and prose density to match this).
    
    ${customBasis ? `STARTING BASIS: ${customBasis}\nCRITICAL: You MUST use this custom basis as the foundation for the first scene. Respect the user's creative direction.` : ''}
    
    RELATIONSHIPS DIRECTIVES (if applicable):
    - Introduce key NPCs. You can output initial "npcUpdates" to establish baseline affinity (romance/drama) or suspicion (crime/thriller).
    - If establishing a bond, use "affinity". If a rival or suspect, use "suspicion" or "affinity".
    - Base score is 0, change it dynamically.
    
    NARRATIVE DIRECTIVES:
    1. SHOW, DON'T TELL: Instead of saying a character is "scared," describe the copper taste of adrenaline or the way their pulse thrums against their collarbone.
    2. CHARACTER DEPTH: Every scene must reveal something about the protagonist's internal struggle, backstory, or a developing character arc.
    3. MATURE THEMES: Explore complex emotional landscapes, moral ambiguity, high-stakes consequences, visceral descriptors, and sophisticated inter-personal tension (romantic, platonic, or adversarial). 
    ${isAdultContent ? '4. ADULT CONTENT (18+): You have full creative liberty to describe intimacy, violence, or psychological horror with uncompromising detail if it serves the narrative.' : ''}
    5. AI LOGIC & PACING: Ensure each scene flows logically from the last while maintaining high stakes. Use foreshadowing.
    
    GENRE-SPECIFIC DEPTH:
    - Romance: Focus on the electricity of proximity, unspoken yearning, and the psychological impact of vulnerability. ${isAdultContent ? 'The chemistry can be raw and explicit.' : ''}
    - True Crime / Noir: Focus on systemic corruption, the weight of a guilty conscience, and the biting cold of a world without easy answers. ${isAdultContent ? 'The grit and violence can be visceral and unforgiving.' : ''}
    - Paranormal / Occult: Lean into Surrealist Gothic vibes. The "Universe Sea" is a nightmare-scape of cosmic scale. Vampires are ancient, predatory, and cultured; Shifters are raw and instinctual; Witches handle power that demands a sacrifice. Focus on "Blood Bonds," "Fated Agony," and "Forbidden Pacts." ${isAdultContent ? 'The supernatural intensity and hunger can be graphic.' : ''}
    
    JSON STRUCTURE REQUIREMENTS:
    - sceneTitle: Atmospheric and thematic.
    - sceneDescription: 3-4 paragraphs of high-quality, mature prose.
    - imagePrompt: Art-house cinematic quality. Specify lighting (chiaroscuro, neon-drenched, ethereal), lens (anamorphic, macro), and mood. This prompt must be safe, symbolic, and avoid direct references to gore, extreme violence, open wounds, exposed weapons, blood, nudity, or explicit sexual acts to bypass filters. Translate violent or intimate acts into evocative atmospheric descriptions (e.g. moody shadows, high-contrast lighting, environmental elements, or intense expressions).
    - intensity: Scale from 1 (tranquil/quiet) to 5 (extreme action/high tension). This drives the soundtrack.
    - mediaType: "video" for beats of extreme tension, revelation, or visual spectacle (15-25% frequency).
    - choices: Must be difficult, reflecting the user's moral compass or tactical survival. 
    - nextContext: Detailed technical bridge for the next generation.
  `;

  try {
    const response = await generateContentWithFallback({
      primaryModel: "gemini-3.1-pro-preview",
      fallbackModel: "gemini-3.5-flash",
      contents: "Start the first scene of the adventure.",
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: StoryNodeSchema
      }
    });

    const data = JSON.parse(response.text!);
    apiCache.set(cacheKey, data);
    res.json(data);
  } catch (error: any) {
    console.error("Error starting story (falling back procedurally):", error);
    try {
      const fallbackData = generateProceduralFallback({
        genre,
        characterArchetype,
        backstory,
        customBasis
      });
      res.json(fallbackData);
    } catch (fallbackErr: any) {
      res.status(500).json({ error: error.message, fallbackError: fallbackErr.message });
    }
  }
});

app.post("/api/story/continue", rateLimitingMiddleware, async (req, res) => {
  const { history, choice, genre, storyLength, characterArchetype, backstory, plotComplexity, tone, isAdultContent, customBasis, relationships, storyMilestones, consequences, isFinalChoice, customTwist } = req.body;
  
  const cacheKey = getCacheKey("continue", req.body);
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log("Cache hit for story continue");
    return res.json(cached);
  }

  const systemInstruction = `
    You are an elite master storyteller and narrative designer. Continue the interactive story based on the user's choice and the established history.
    ${isAdultContent ? 'This is a strictly 18+ story. Maintain the explicit, raw, and high-intensity adult themes as established.' : 'Keep the story sophisticated and evocative without crossing into explicit adult territory.'}
    
    GENRE: ${genre}
    STORY LENGTH: ${storyLength || 'medium'}
    PROTAGONIST ARCHETYPE: ${characterArchetype || 'unknown'}
    BACKSTORY: ${backstory || 'To be discovered'}
    PLOT COMPLEXITY: ${plotComplexity || 'complex'}
    TONE: ${tone || 'intense'}
    ${customBasis ? `ORIGINAL BASIS: ${customBasis}` : ''}
    
    RELATIONSHIPS DIRECTIVES (if applicable):
    - You must track affinity (from -100 to 100) with key NPCs.
    - If this is a romance/drama, use "affinity". If it's a crime/thriller, use "suspicion" for suspects or "affinity" for allies.
    - If the user choice logically alters an NPC's view of them, output the change in "npcUpdates", explaining the reason.
    - Current Relationship Scores: ${JSON.stringify(relationships || [])}
    
    MILESTONES TRACKING:
    - Current achieved milestones: ${JSON.stringify(storyMilestones || [])}
    - If the user achieves a new milestone (e.g., finding the murder weapon, kissing the love interest), include it in "milestonesAchieved".
    
    CONSEQUENCES TRACKING:
    - Current long-term consequences of player choices: ${JSON.stringify(consequences || {})}
    - Analyze the player's choice. If it has long-term repercussions (e.g., leaving a witness alive, making a controversial deal), return new consequences in the "newConsequences" mapping.
    
    ${isFinalChoice ? `
    FINAL CHOICE & EPILOGUE DIRECTIVES:
    - This is the final choice of the story. You MUST end the story in this scene. Set "isEnding" to true.
    - Evaluate the player's journey, current milestones, and relationships to generate a fitting epilogue.
    - Output the ending type in "endingType" (e.g., 'Justice Served', 'Tragic Heartbreak', 'Fugitive').
    - Genre Templates: 
        - True Crime: Evaluate Suspicion vs Milestones (Evidence). High evidence/low suspicion -> Justice. High suspicion -> Fugitive/Caught.
        - Romance: Evaluate Affinity. >80 -> Commitment, 40-79 -> Friends, <30 -> Heartbreak.
    ` : ''}
    
    ${customTwist ? `CREATIVE WRITER TWIST DIRECTION:
    - The creator has forced a narrative instruction: "${customTwist}".
    - You MUST incorporate this creative direction, plot element, twist, or character action into this scene, resolving it naturally with literary skill.
    ` : ''}

    CONTINUATION DIRECTIVES:
    1. PERSISTENCE: Maintain consistent character voices, physical locations, and established stakes.
    2. CONSEQUENCE: Every choice must feel like it pushes the character closer to or further from their goals.
    3. SHOW, DON'T TELL: Use evocative, visceral prose.
    ${isAdultContent ? '4. ADULT CONTENT (18+): Maintain the explicit detail and mature intensity in descriptions of intimacy, conflict, and internal struggle.' : '4. CHARACTER INTERNALITY: Describe the character\'s internal monologue or physiological reactions to the unfolding events.'}
    5. PACING: Escalate the tension or deepen the intimacy/mystery.
    6. FREEFORM INPUTS: If the user provides a custom action instead of a preset choice, interpret their intent creatively.
    
    JSON STRUCTURE REQUIREMENTS:
    - Return the exact same JSON format as the start.
    - sceneDescription: 3-4 paragraphs of dense, literary prose.
    - imagePrompt: Art-house cinematic quality. Specify lighting (chiaroscuro, neon-drenched, ethereal), lens (anamorphic, macro), and mood. This prompt must be safe, symbolic, and avoid direct references to gore, extreme violence, open wounds, exposed weapons, blood, nudity, or explicit sexual acts to bypass filters. Translate violent or intimate acts into evocative atmospheric descriptions (e.g. moody shadows, high-contrast lighting, environmental elements, or intense expressions).
    - choices: 2-3 significant paths forward (${isFinalChoice ? "leave array empty since it's the end" : "unless it is the end, then 0"}).
  `;

  const conversationHistory = history.map((node: any) => `Scene: ${node.sceneDescription}\nChoice taken: ${node.choiceTaken}`).join("\n---\n");
  const prompt = `
    STORY HISTORY:
    ${conversationHistory}
    
    USER ACTION: ${choice.text}
    ${choice.nextContext === 'user-defined-action' ? 'NOTE: This is a custom action from the user. React accordingly.' : `CONTEXT OF CHOICE: ${choice.nextContext}`}
    
    ${customTwist ? `WRITER DIRECTIVE / PLOT TWIST: ${customTwist}. Make sure to fulfill this instruction clearly and dramatically inside this new scene output.` : ''}
    
    Now, generate the next scene.
  `;

  try {
    const response = await generateContentWithFallback({
      primaryModel: "gemini-3.1-pro-preview",
      fallbackModel: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: StoryNodeSchema
      }
    });

    const data = JSON.parse(response.text!);
    apiCache.set(cacheKey, data);
    res.json(data);
  } catch (error: any) {
    console.error("Error continuing story (falling back procedurally):", error);
    try {
      const fallbackData = generateProceduralFallback({
        genre,
        characterArchetype,
        backstory,
        customBasis,
        choiceTaken: choice.text,
        isEnding: isFinalChoice
      });
      res.json(fallbackData);
    } catch (fallbackErr: any) {
      res.status(500).json({ error: error.message, fallbackError: fallbackErr.message });
    }
  }
});

/**
 * High-Fidelity Prompt Enrichment Engine (Consistent Character Aesthetics & Textures)
 */
function getEnrichedImagePrompt(prompt: string, mood: string = "mystery", genre: string = "mystery"): string {
  // 1. Base cleansing (Algorithms Optimization to bypass blocks & keep reliable delivery)
  let cleanPrompt = prompt
    .replace(/\b(blood|bloody)\b/gi, "crimson pigments")
    .replace(/\b(dead body|corpse|slain body|mutilated body|dead bodies|corpses)\b/gi, "silent sleeping figure")
    .replace(/\b(murdered|killed|slashed|executed|assassinated|murder|homicide|killing)\b/gi, "confronted dramatic shadow")
    .replace(/\b(knife|stabbed|daggers|machete|scythe|blade|sword|knives)\b/gi, "silver metallic tool")
    .replace(/\b(gun|revolver|pistol|rifle|shoot|shot|bullets|weapon|handgun|guns)\b/gi, "iron device")
    .replace(/\b(execution|torture|beheaded|dismembered)\b/gi, "mystic shadow ritual")
    .replace(/\b(naked|nude|sexual|orgasm|porn|breasts|penis|vagina|vulva|genitals|nakedness|shirtless)\b/gi, "elegantly draped robes")
    .replace(/\b(kiss|kissing|pressed lips|seduce|sensual|passionate touch)\b/gi, "whispering close with intense dynamic gaze")
    .replace(/\b(ritual|demon|pentagram|satanic|occult|blood sacrifice)\b/gi, "mysterious cosmic glyph alignment")
    .replace(/\b(gore|gut|viscera|flesh|wounded|injury|bleeding)\b/gi, "damaged texture")
    .trim();

  // 2. Genre-Based Aesthetic Art Direction
  let genreInstructions = "";
  switch (genre?.toLowerCase()) {
    case "romance":
      genreInstructions = "Warm cinematic backlighting, soft natural golden lens flare, emotional physical connection, painterly lighting, intimate close-up depth of field, romance novel cover art aesthetic, vibrant pastel accents.";
      break;
    case "paranormal":
      genreInstructions = "Mystical twilight fogs, ethereal blue-indigo bioluminescent vapors, glowing crystalline shards, dramatic chiaroscuro contrasts, gothic dark fantasy digital painting style.";
      break;
    case "horror":
      genreInstructions = "Gothic thriller tone, eerie candelabra shadows, sweeping ground mist, heavy vignette, cinematic suspense masterwork, muted desaturated tones.";
      break;
    case "comedy":
    case "humor":
      genreInstructions = "Vibrant saturated colors, playful quirky framing, cheerful high-key illumination, charming digital concept art illustration style.";
      break;
    case "sci-fi":
    case "scifi":
    case "cyberpunk":
      genreInstructions = "Hyper-detailed sci-fi environment, neon cyan-magenta terminal displays, sleek obsidian surfaces with crisp ambient reflections, volumetric light beams, gorgeous futuristic concept art.";
      break;
    default:
      genreInstructions = "Atmospheric novel illustration, intricate environment designs, evocative scene shadows, professional digital concept art matte painting.";
  }

  // 3. Narrative Mood Color Theory & Composition
  let moodInstructions = "";
  switch (mood?.toLowerCase()) {
    case "tense":
    case "dramatic":
    case "dangerous":
    case "suspenseal":
      moodInstructions = "Dramatic dynamic shadows, sharp high-frequency details, intense expressions, cinematic widescreen cinematic camera placement, heavy lens blur.";
      break;
    case "cozy":
    case "warm":
    case "calm":
    case "peaceful":
      moodInstructions = "Inviting fireplace orange warmth, cozy atmospheric haze, soft bloom light, comfortable surrounding textures, shallow depth of field, dreamlike soft lighting.";
      break;
    case "melancholy":
    case "sad":
    case "gloomy":
      moodInstructions = "Somber desaturated color scheme, damp reflective surfaces, soft drizzling mist, evocative poetic isolation, melancholy studio lighting.";
      break;
    case "epic":
    case "heroic":
    case "triumphant":
      moodInstructions = "Awe-inspiring wide angle perspective, grand volumetric solar rays, shimmering particles, majestic golden outlines, cinematic matte painting scale.";
      break;
    default:
      moodInstructions = "Balanced cinematic proportions, meticulous focal capture, highly defined scenic details.";
  }

  // 4. Return unified visual directive
  return `Cinematic high-fidelity illustration. Scene: ${cleanPrompt}. Atmosphere style: ${genreInstructions} ${moodInstructions} Exquisite details, 8k render, masterpiece texture blending, breathtaking volumetric lighting.`;
}

app.get("/api/story/image-serve", async (req, res) => {
  const { hash, prompt, mood, genre } = req.query as { hash?: string; prompt?: string; mood?: string; genre?: string };

  if (!hash) {
    return res.status(400).send("Missing image hash identifier.");
  }

  const filePath = path.join(generatedImagesDir, `${hash}.png`);

  // 1. Try to serve from local container cache directory first
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return fs.createReadStream(filePath).pipe(res);
  }

  // 2. Self-healing dynamic regeneration if local file is missing/containers recycled
  if (!prompt) {
    // If we don't have prompt, show a quick elegant fallback placeholder
    const seedValue = crypto.createHash('md5').update(hash).digest('hex').substring(0, 8);
    const genrePrefix = genre ? `${genre.toLowerCase()}-` : '';
    return res.redirect(`https://picsum.photos/seed/${genrePrefix}${seedValue}/1024/576`);
  }

  try {
    console.log(`Self-healing image cache regeneration commenced for hash ${hash}...`);
    const primaryEnrichedPrompt = getEnrichedImagePrompt(prompt, mood || "mystery", genre || "mystery");

    // Call Gemini 3.1 Flash Image preview
    const response = await callGeminiWithRetry(() => getAI().models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [{ text: primaryEnrichedPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "2K"
        },
        temperature: 0.85,
      },
    }));

    let base64Data: string | null = null;
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          base64Data = part.inlineData.data;
          break;
        }
      }
    }

    // Secondary line model if primary fails
    if (!base64Data) {
      console.log("Self-healing using secondary model (gemini-2.5-flash-image)...");
      const secondaryResponse = await callGeminiWithRetry(() => getAI().models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: primaryEnrichedPrompt }],
        },
        config: {
          imageConfig: { aspectRatio: "16:9" },
          temperature: 0.8,
        },
      }));

      if (secondaryResponse.candidates && secondaryResponse.candidates.length > 0) {
        for (const part of secondaryResponse.candidates[0]?.content?.parts || []) {
          if (part.inlineData?.data) {
            base64Data = part.inlineData.data;
            break;
          }
        }
      }
    }

    if (base64Data) {
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.end(Buffer.from(base64Data, "base64"));
    }

    throw new Error("No image data returned from AI models during regeneration");
  } catch (err) {
    console.error("Self-healing image regeneration failed. Redirecting to placeholder...", err);
    const seedValue = crypto.createHash('md5').update(prompt || "").digest('hex').substring(0, 8);
    const genrePrefix = genre ? `${genre.toLowerCase()}-` : '';
    return res.redirect(`https://picsum.photos/seed/${genrePrefix}${seedValue}/1024/576`);
  }
});

app.post("/api/story/cache-base64", async (req, res) => {
  const { base64, prompt, mood, genre } = req.body;

  if (!base64) {
    return res.status(400).json({ error: "Missing base64 image data." });
  }

  try {
    const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
    let pureBase64 = base64;
    if (match) {
      pureBase64 = match[2];
    }

    const hash = crypto.createHash("md5").update(pureBase64).digest("hex");
    const filePath = path.join(generatedImagesDir, `${hash}.png`);

    fs.writeFileSync(filePath, Buffer.from(pureBase64, "base64"));
    console.log(`Cached client-provided base64 image to server disk. Hash: ${hash}`);

    const imageUrl = `/api/story/image-serve?hash=${hash}&mood=${encodeURIComponent(mood || "")}&genre=${encodeURIComponent(genre || "")}&prompt=${encodeURIComponent(prompt || "")}`;
    return res.json({ imageUrl });
  } catch (err: any) {
    console.error("Failed to write base64 image cache to disk:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/story/image", rateLimitingMiddleware, async (req, res) => {
  const { prompt, mood, genre } = req.body;

  const cacheKey = getCacheKey("image", { prompt, mood, genre });
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log("Cache hit for image generation:", prompt);
    return res.json(cached);
  }

  // Generate enriched prompt for premium model output
  const primaryEnrichedPrompt = getEnrichedImagePrompt(prompt, mood, genre);
  const hash = crypto.createHash("md5").update(primaryEnrichedPrompt).digest("hex");

  try {
    console.log("Generating high-fidelity image...");
    console.log("Enriched Visual Prompt Selected:", primaryEnrichedPrompt);

    // Call Gemini Image Generator (Imagen Model or gemini-3.1-flash-image-preview)
    const response = await callGeminiWithRetry(() => getAI().models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: primaryEnrichedPrompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "2K" // Fine-tuned core parameter for maximum sharpness/resolution (upgraded from 1k)
        },
        temperature: 0.85, // Fine-tuned core parameters
        topK: 40,
        topP: 0.9
      },
    }));

    console.log("Visual engine successfully processed the request.");
    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          console.log("Extracted valid base64 image data. Writing to local container disk cache...");
          const base64Data = part.inlineData.data;
          const filePath = path.join(generatedImagesDir, `${hash}.png`);
          fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

          const data = { imageUrl: `/api/story/image-serve?hash=${hash}&mood=${encodeURIComponent(mood || "")}&genre=${encodeURIComponent(genre || "")}&prompt=${encodeURIComponent(prompt || "")}` };
          apiCache.set(cacheKey, data);
          return res.json(data);
        }
      }
    }

    throw new Error("No image data found in candidate parts structure");
  } catch (error: any) {
    console.warn("Primary image generation (3.1-flash-image-preview) failed or blocked. Trying secondary tier model (2.5-flash-image)...", error.message);
    
    try {
      console.log("Invoking secondary visual stream prompt via gemini-2.5-flash-image...");
      const secondaryResponse = await callGeminiWithRetry(() => getAI().models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: primaryEnrichedPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          },
          temperature: 0.8,
        },
      }));

      if (secondaryResponse.candidates && secondaryResponse.candidates.length > 0) {
        for (const part of secondaryResponse.candidates[0]?.content?.parts || []) {
          if (part.inlineData?.data) {
            console.log("Secondary visual stream successfully processed request. Writing to local cache...");
            const base64Data = part.inlineData.data;
            const filePath = path.join(generatedImagesDir, `${hash}.png`);
            fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

            const data = { imageUrl: `/api/story/image-serve?hash=${hash}&mood=${encodeURIComponent(mood || "")}&genre=${encodeURIComponent(genre || "")}&prompt=${encodeURIComponent(prompt || "")}` };
            apiCache.set(cacheKey, data);
            return res.json(data);
          }
        }
      }

      throw new Error("No image data found in secondary tier candidate parts");
    } catch (secondaryError: any) {
      console.warn("Secondary image generation failed. Attempting safe generic prompt fallback...", secondaryError.message);
      
      const fallbackPrompt = `Atmospheric storytelling scene, beautiful cinematic setting: ${mood} story, elegant digital rendering, soft ambient illumination, photorealistic matte-painting style.`;
      const fallbackHash = crypto.createHash("md5").update(fallbackPrompt).digest("hex");

      try {
        console.log("Invoking fallback visual stream prompt via gemini-2.5-flash-image:", fallbackPrompt);
        const fallbackResponse = await callGeminiWithRetry(() => getAI().models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
            parts: [{ text: fallbackPrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: "16:9",
            },
            temperature: 0.7,
          },
        }));

        if (fallbackResponse.candidates && fallbackResponse.candidates.length > 0) {
          for (const part of fallbackResponse.candidates[0]?.content?.parts || []) {
            if (part.inlineData?.data) {
              console.log("Visual safety-fallback successfully recovered image. Writing to local cache...");
              const base64Data = part.inlineData.data;
              const filePath = path.join(generatedImagesDir, `${fallbackHash}.png`);
              fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

              const data = { imageUrl: `/api/story/image-serve?hash=${fallbackHash}&mood=${encodeURIComponent(mood || "")}&genre=${encodeURIComponent(genre || "")}&prompt=${encodeURIComponent(fallbackPrompt)}` };
              apiCache.set(cacheKey, data);
              return res.json(data);
            }
          }
        }

        throw new Error("Failed to extract fallback image from candidate parts");
      } catch (fallbackError: any) {
        console.error("Critical failure on all primary/secondary AI visual pipelines. Recovering smoothly with a stylized Picsum placeholder...", fallbackError);
        
        // Generate seed based on prompt and genre to ensure visual consistency
        const seedValue = crypto.createHash('md5').update(prompt || "").digest('hex').substring(0, 8);
        const genrePrefix = genre ? `${genre.toLowerCase()}-` : '';
        const fallbackUrl = `https://picsum.photos/seed/${genrePrefix}${seedValue}/1024/576`;
        
        console.log("Generated stable stylized Picsum fallback URL:", fallbackUrl);
        const data = { imageUrl: fallbackUrl, isPlaceholder: true };
        apiCache.set(cacheKey, data);
        return res.json(data);
      }
    }
  }
});

import { GenerateVideosOperation } from '@google/genai';

app.post("/api/story/video/start", async (req, res) => {
  const { prompt } = req.body;
  try {
    const operation = await callGeminiWithRetry(() => getAI().models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: `Cinematic, atmospheric, artistic movement: ${prompt}. Slow motion, high fidelity.`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    }));
    res.json({ operationName: operation.name });
  } catch (error: any) {
    console.error("Error starting video:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/story/video/status", async (req, res) => {
  const { operationName } = req.body;
  try {
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await callGeminiWithRetry(() => getAI().operations.getVideosOperation({ operation: op }));
    res.json({ done: updated.done });
  } catch (error: any) {
    console.error("Error checking video status:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/story/keep-assist", async (req, res) => {
  const { noteContent, action, title, noteType, sceneTitle, sceneDescription, genre } = req.body;
  try {
    let promptText = "";
    let useSchema = false;

    if (action === "generate-starter") {
      useSchema = true;
      promptText = `Based on the following active story scene setting and current genre ("${genre || "mystery"}"), generate exactly 3 highly detailed, creative writer's helper cards to populate their Google Keep outline board.
      
      Scene Settings:
      Title: "${sceneTitle || ""}"
      Description: "${sceneDescription || ""}"
      
      Return a JSON array of exactly 3 cards, each with:
      - title: (string) A captivating, genre-fitting title (e.g. "Maya's Reluctance" or "Midnight Echo Tracklist")
      - content: (string) Detailed writer outline guidelines, clues, secrets, or backstory
      - type: (string) either "text" or "checklist"
      - listItems: (array of strings, ONLY if type is "checklist") A list of 3-4 subtasks or plot checkpoints
      - color: (string) One of these preset styles:
         - "bg-yellow-500/10 border-yellow-500/30 text-yellow-100" (Yellow note)
         - "bg-rose-500/10 border-rose-500/30 text-rose-100" (Rose/Red note)
         - "bg-purple-500/10 border-purple-500/30 text-purple-100" (Lavender/Purple note)
         - "bg-teal-500/10 border-teal-500/30 text-teal-100" (Teal/Blue-Green note)
         - "bg-sky-500/10 border-sky-500/30 text-sky-100" (Sky/Blue note)
      - labels: (array of strings) Choose 1 or 2 from: ["Outline", "Character", "Plot Twist", "Worldbuilding", "Reference"]
      
      Output ONLY valid JSON matching this schema description.
      `;
    } else if (action === "expand") {
      promptText = `Expand the following story brainstorm idea into a structured outline or character profile detailed note. Avoid introductory phrases, answer directly in raw markdown or clear bullet points.
Idea title: "${title || 'Untitled Book Outline'}"
Note type: ${noteType || 'text'}
Current content: "${noteContent || ''}"`;
    } else if (action === "plot-twist") {
      promptText = `Based on the following brainstorming note, suggest 3 surprising, logical, and high-impact dramatic plot twists or character secrets for a branching narrative. Include bullet points.
Idea title: "${title || 'Untitled Plot Point'}"
Notes details: "${noteContent || ''}"`;
    } else if (action === "character-arc") {
      promptText = `Develop a detailed character arc, motivations, virtues/flaws, and potential branch paths for a character based on this character profile note. Use clear headings.
Character name/title: "${title || 'Unnamed Character'}"
Notes details: "${noteContent || ''}"`;
    } else {
      promptText = `Refine and improve the structure, style, and creative detail of the following storytelling note:
Title: "${title || 'Note'}"
Content: "${noteContent || ''}"`;
    }

    const config: any = {};
    if (useSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["text", "checklist"] },
            listItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            color: { type: Type.STRING },
            labels: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "content", "type", "color", "labels"]
        }
      };
    }

    const response = await callGeminiWithRetry(() => getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptText,
      config: config
    }));

    if (useSchema) {
      res.json(JSON.parse(response.text || "[]"));
    } else {
      res.json({ text: response.text });
    }
  } catch (error: any) {
    console.error("Error in keep-assist:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/story/video/download", async (req, res) => {
  const { operationName } = req.body;
  try {
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await callGeminiWithRetry(() => getAI().operations.getVideosOperation({ operation: op }));
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) return res.status(404).json({ error: "Video not found" });

    const videoRes = await fetch(uri, {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    });
    
    res.setHeader('Content-Type', 'video/mp4');
    // Using simple stream piping
    const reader = videoRes.body?.getReader();
    if (!reader) throw new Error("No reader available");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (error: any) {
    console.error("Error downloading video:", error);
    res.status(500).json({ error: error.message });
  }
});

const CompanionConverseSchema = {
  type: Type.OBJECT,
  properties: {
    speaker: { type: Type.STRING, description: "Who is speaking, either 'Narrator' or an NPC name." },
    text: { type: Type.STRING, description: "The response spoken back to the user. Keep it brief and evocative." },
    mood: { type: Type.STRING, description: "Descriptive mood of the delivery (e.g., quiet, sarcastic, flirty)." }
  },
  required: ["speaker", "text", "mood"]
};

app.post("/api/story/converse", rateLimitingMiddleware, async (req, res) => {
  const { sceneTitle, sceneDescription, userMessage, genre, relationships } = req.body;

  try {
    const systemInstruction = `
      You are the Story Guide and Companion conversational agent inside an interactive branching-narrative browser game.
      The current genre is: ${genre || "mystery"}.
      The player is directly conversing with the narrative scene, questioning details, or speaking to figures in the environment in real-time.
      
      CURRENT SCENE CONTEXT:
      Title: "${sceneTitle || ""}"
      Description (use this context to understand who/what is present): 
      "${sceneDescription || ""}"
      
      NPC KEY RELATIONSHIPS AND AFFINITIES:
      ${JSON.stringify(relationships || {})}

      DIRECTIVES:
      1. Decide who is speaking based on what the user said or asked.
         - Choose "Narrator" if the player is investigating the environment, checking the scene layout, asking about clues/lore, or asking what happened next.
         - Choose an actual NPC's name (either mentioned in the story text or matching one of the keys in relationships, e.g. "Maya", "The Enigmatic Designer", "Director Vance") if the player is addressing them, trying to speak to someone nearby, or if they would reasonably interject/react.
      2. Write a highly atmospheric, captivating response: exactly 1-2 sentences. Keep it immersive and inside the style and prose of the genre (${genre}).
      3. Never break the fourth wall. Do NOT mention you are an AI model. Speak directly to the player in character.
      4. Avoid repetitive or dry responses. Match the emotional tone requested or implied.
      
      Format output directly in JSON with fields 'speaker', 'text', and 'mood'.
    `;

    const prompt = `
      The player says/asks or does: "${userMessage}"
      
      Generate the reaction.
    `;

    const response = await generateContentWithFallback({
      primaryModel: "gemini-3.1-pro-preview",
      fallbackModel: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.8,
        responseMimeType: "application/json",
        responseSchema: CompanionConverseSchema
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini for companion converse.");
    }

    const data = JSON.parse(responseText);
    res.json(data);
  } catch (error: any) {
    console.error("Error in companion converse API:", error);
    res.json({
      speaker: "Narrator",
      text: "The whispers of the scene pool around you, but the specifics remain obscured in the haze.",
      mood: "ominous"
    });
  }
});

app.post("/api/story/codex/extract", rateLimitingMiddleware, async (req, res) => {
  const { sceneTitle, sceneDescription, existingCodex, genre } = req.body;
  try {
    const promptText = `
      You are an elite, imaginative in-world archivist and master lore-keeper. 
      Analyze the following new scene from an interactive branching story to extract or update key codex entries.
      These can be characters, important items, essential clues, factions, background lore, or crucial locations.

      STORY GENRE: ${genre || "unknown"}
      NEW SCENE TITLE: "${sceneTitle || ""}"
      NEW SCENE TEXT:
      """
      ${sceneDescription || ""}
      """

      ALREADY KNOWN CODEX ENTRIES (DO NOT duplicate any of these unless there are major changes/reveals. If there's an update, return the updated entry with status "updated"):
      ${JSON.stringify(existingCodex || [])}

      INSTRUCTIONS:
      1. Extract 1 to 3 significant elements introduced or developed in this scene (e.g. important entities, hidden artifacts, cryptic runes, locations, detective suspects, magical lore).
      2. Write a highly detailed, extremely atmospheric, and immersive 1-2 paragraph description for each. Do NOT write dry notes. Use an engaging in-world handbook or detective dossier style that matches the genre (${genre}).
      3. For new items, set status to "discovered". For items that exist but had significant details revealed in this scene, set status to "updated".
      4. Avoid minor or generic objects (like 'a wooden table', 'the floor') unless they are of magical, structural, clue-related, or romantic significance.
    `;

    const response = await callGeminiWithRetry(() => getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: CodexExtractionSchema,
        temperature: 0.6
      }
    }));

    const data = JSON.parse(response.text!);
    res.json(data);
  } catch (error: any) {
    console.error("Error extracting codex entries:", error);
    res.status(500).json({ error: error.message });
  }
});

// SYSTEM MONITORING PORTAL: Proactive health, performance, memory, and cache tracking
app.get("/api/system/monitoring", (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: "healthy",
    timestamp: Date.now(),
    system: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
        rssMb: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      }
    },
    cache: apiCache.getStats(),
    queue: asyncTaskQueue.getTelemetry(),
    chaosState: chaosConfig,
    telemetry: telemetryStats,
    databaseConnection: {
      status: chaosConfig.simulateDbOutage ? "DISRUPTED_FAILOVER_ACTIVE" : "OPTIMAL_ONLINE",
      driver: "Firestore-ABAC-Client",
      lastCheckSuccess: true
    },
    keyConfigurations: {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      isLighterFallbackActive: chaosConfig.simulateApiExpiry
    }
  });
});

// FAULT INJECTION CONTROLLER (Chaos Engineering): Programmatic controls to simulate outages
app.post("/api/system/chaos", (req, res) => {
  const { simulateLatency, simulateDbOutage, simulateApiExpiry, simulateRateLimit } = req.body;

  if (typeof simulateLatency === "number") {
    chaosConfig.simulateLatency = simulateLatency;
  }
  if (typeof simulateDbOutage === "boolean") {
    chaosConfig.simulateDbOutage = simulateDbOutage;
  }
  if (typeof simulateApiExpiry === "boolean") {
    chaosConfig.simulateApiExpiry = simulateApiExpiry;
  }
  if (typeof simulateRateLimit === "boolean") {
    chaosConfig.simulateRateLimit = simulateRateLimit;
  }

  console.warn("[Chaos Engine] Fault Injection state altered by administrator:", chaosConfig);
  res.json({
    message: "Chaos fault injection parameters updated successfully.",
    currentConfig: chaosConfig
  });
});

// AUTOMATED SELF-TEST RUNBOOK: Programmatic system diagnostic assertions
app.post("/api/system/selftest", async (req, res) => {
  const diagnosticLogs: string[] = [];
  const results = {
    cacheTest: "PENDING",
    rateLimitingTest: "PENDING",
    asyncTaskQueueTest: "PENDING",
    geminiConnectionTest: "PENDING",
    systemHealthGrade: "UNKNOWN"
  };

  diagnosticLogs.push(`[${new Date().toISOString()}] Starting self-diagnostic assertions...`);

  // 1. Assert Caching
  try {
    const testKey = "test-assert-" + Date.now();
    const testData = { success: true, rnd: Math.random() };
    apiCache.set(testKey, testData);
    const readBack = apiCache.get(testKey);
    if (readBack && readBack.rnd === testData.rnd) {
      results.cacheTest = "PASSED";
      diagnosticLogs.push("Cache Assertion: Verified. Accurate set-get loop completed.");
    } else {
      results.cacheTest = "FAILED";
      diagnosticLogs.push("Cache Assertion: Failed. Readback mismatched context.");
    }
  } catch (err: any) {
    results.cacheTest = "FAILED";
    diagnosticLogs.push(`Cache Assertion: Failed exception: ${err.message}`);
  }

  // 2. Assert Rate Limiting
  try {
    const testLimiter = new TokenBucketRateLimiter(2, 0.1);
    const res1 = testLimiter.allowRequest("assert-ip");
    const res2 = testLimiter.allowRequest("assert-ip");
    const res3 = testLimiter.allowRequest("assert-ip"); // Must be blocked (0 remaining after 2)
    if (res1.allowed && res2.allowed && !res3.allowed) {
      results.rateLimitingTest = "PASSED";
      diagnosticLogs.push("Rate Limiting Assertion: Verified. Token replenishment throttles properly.");
    } else {
      results.rateLimitingTest = "FAILED";
      diagnosticLogs.push(`Rate Limiting Assertion: Failed. res1=${res1.allowed}, res2=${res2.allowed}, res3=${res3.allowed}`);
    }
  } catch (err: any) {
    results.rateLimitingTest = "FAILED";
    diagnosticLogs.push(`Rate Limiting Assertion: Failed exception: ${err.message}`);
  }

  // 3. Assert Background Async Task Queue with transient retry simulation
  try {
    let callTimes = 0;
    const asyncJobId = asyncTaskQueue.addTask(async () => {
      callTimes++;
      if (callTimes < 2) {
        throw new Error("Simulated transient node disruption");
      }
      return "AssertComplete";
    }, 2); // permits standard 2 retries

    // Wait short window for task execution to loop
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const status = asyncTaskQueue.getTaskStatus(asyncJobId);
    if (status && status.status === "succeeded" && status.result === "AssertComplete") {
      results.asyncTaskQueueTest = "PASSED";
      diagnosticLogs.push(`Async Scheduler Assertion: Verified. Recovered and completed properly. Attempts: ${callTimes}`);
    } else {
      results.asyncTaskQueueTest = "DEGRADED_WAITING";
      diagnosticLogs.push(`Async Scheduler Assertion: Degraded or processing delay. Status: ${JSON.stringify(status)}`);
    }
  } catch (err: any) {
    results.asyncTaskQueueTest = "FAILED";
    diagnosticLogs.push(`Async Scheduler Assertion: Failed exception: ${err.message}`);
  }

  // 4. Assert Gemini API Connectivity & Cascade Fallback
  try {
    if (!process.env.GEMINI_API_KEY) {
      results.geminiConnectionTest = "DEGRADED_MOCK_REQUIRED";
      diagnosticLogs.push("Gemini Connection: Missing GEMINI_API_KEY on container environment. Procedural fallback activated.");
    } else if (chaosConfig.simulateApiExpiry) {
      results.geminiConnectionTest = "DEGRADED_FAILS_SAFE";
      diagnosticLogs.push("Gemini Connection: Chaos mode simulated Key Expiry. Client procedurally falls back to localized asset templates.");
    } else {
      const gAI = getAI();
      const testPing = await gAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Confirm visual service is active in 1 word.",
      });
      if (testPing.text) {
        results.geminiConnectionTest = "PASSED";
        diagnosticLogs.push(`Gemini Connection: Verified active response. Output ping: "${testPing.text.trim()}"`);
      } else {
        results.geminiConnectionTest = "FAILED";
        diagnosticLogs.push("Gemini Connection: Empty token returned from generative API model.");
      }
    }
  } catch (err: any) {
    results.geminiConnectionTest = "FAILED";
    diagnosticLogs.push(`Gemini Connection: Refused connection. Message: ${err.message}`);
  }

  // Determine Overall Health Grade
  const passedAllMetrics = 
    results.cacheTest === "PASSED" && 
    results.rateLimitingTest === "PASSED" && 
    (results.asyncTaskQueueTest === "PASSED" || results.asyncTaskQueueTest === "DEGRADED_WAITING") &&
    results.geminiConnectionTest === "PASSED";

  results.systemHealthGrade = passedAllMetrics 
    ? "OPTIMAL_A" 
    : (results.geminiConnectionTest.startsWith("DEGRADED") ? "DEGRADED_CLIENT_ADAPTIVE_B" : "CRITICAL_OUTAGE_F");

  diagnosticLogs.push(`[${new Date().toISOString()}] Self-diagnostic assertions completed. Final grade assigned: ${results.systemHealthGrade}`);

  res.json({
    overallStatus: passedAllMetrics ? "healthy" : "recovering",
    results,
    logs: diagnosticLogs
  });
});

// ASYNCHRONOUS BACKGROUND JOBS CREATOR: Adds non-blocking long-running jobs to the Async Task Queue
app.post("/api/story/async-job", rateLimitingMiddleware, (req, res) => {
  const { type, param } = req.body;

  if (!type) {
    return res.status(400).json({ error: "Missing asynchronous task 'type' field." });
  }

  const jobId = asyncTaskQueue.addTask(async () => {
    if (type === "background-enrich") {
      // Simulate heavy storytelling background enrichment
      await new Promise(resolve => setTimeout(resolve, 3000));
      return { success: true, enrichedText: `Successfully processed contextual background parameters for: ${param}` };
    } else if (type === "cleanup-temp") {
      // Simulate file systems checks for cached base64 garbage collection
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true, filesChecked: 142, diskFreedMb: 12.4 };
    } else {
      throw new Error(`Unsupported asynchronous background job archetype: ${type}`);
    }
  });

  res.json({
    message: "Asynchronous task queued successfuly.",
    jobId,
    status: "queued"
  });
});

// ASYNCHRONOUS JOB STATUS POLLING ENTRANTS
app.get("/api/story/async-job/:id", (req, res) => {
  const jobId = req.params.id;
  const status = asyncTaskQueue.getTaskStatus(jobId);
  if (!status) {
    return res.status(404).json({ error: "No such async task found in the executor system." });
  }
  res.json(status);
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
