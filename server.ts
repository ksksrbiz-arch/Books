import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";
import compression from "compression";

dotenv.config();

// Simple in-memory LRU-ish cache to improve loading and generating speeds
class ResponseCache {
  private cache = new Map<string, { data: any, timestamp: number }>();
  private maxItems = 500;

  get(key: string) {
    const item = this.cache.get(key);
    if (item) {
      item.timestamp = Date.now(); // update access time
      return item.data;
    }
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
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

const apiCache = new ResponseCache();

function getCacheKey(prefix: string, body: any): string {
  // We ignore properties that shouldn't affect the cache or we just hash the entire body
  const bodyHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return `${prefix}:${bodyHash}`;
}

const app = express();
const PORT = 3000;

app.use(compression());
app.use(express.json());

// Lazy initialize Gemini
let genAI: GoogleGenAI | null = null;
function getAI() {
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

app.post("/api/story/premise", async (req, res) => {
  const { genre, ignoreCache } = req.body;
  
  const cacheKey = getCacheKey("premise", { genre });
  if (!ignoreCache) {
    const cached = apiCache.get(cacheKey);
    if (cached) {
      console.log("Cache hit for premise:", genre);
      return res.json(cached);
    }
  }

  const prompt = `Generate 3 completely unique, highly compelling and remarkably diverse story premises for the genre: ${genre}.
To ensure variety, incorporate vastly different subgenres, tones, and unexpected character types. Push the boundaries of the genre and avoid cliches.
Each premise must include:
- archetype: A unique, highly specific character archetype (e.g., "A cybernetically enhanced antique dealer" instead of just "Detective").
- backstory: A deep, haunting past or a burning ambition that intimately ties to the genre's core themes.
- customBasis: The shocking hook, inciting incident, or starting situation that immediately thrusts them into the conflict.
- title: A catchy, evocative title for this premise.
Make each of the three premises feel wildly different from the others in tone, setting, and conflict.`;

  try {
    const response = await callGeminiWithRetry(() => getAI().models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        temperature: 0.9,
        responseMimeType: "application/json",
        responseSchema: PremiseSchema
      }
    }));
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

// API routes
app.post("/api/story/start", async (req, res) => {
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
    - imagePrompt: Art-house cinematic quality. Specify lighting (chiaroscuro, neon-drenched, ethereal), lens (anamorphic, macro), and mood.
    - intensity: Scale from 1 (tranquil/quiet) to 5 (extreme action/high tension). This drives the soundtrack.
    - mediaType: "video" for beats of extreme tension, revelation, or visual spectacle (15-25% frequency).
    - choices: Must be difficult, reflecting the user's moral compass or tactical survival. 
    - nextContext: Detailed technical bridge for the next generation.
  `;

  try {
    const response = await callGeminiWithRetry(() => getAI().models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: "Start the first scene of the adventure.",
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: StoryNodeSchema
      }
    }));

    const data = JSON.parse(response.text!);
    apiCache.set(cacheKey, data);
    res.json(data);
  } catch (error: any) {
    console.error("Error starting story:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/story/continue", async (req, res) => {
  const { history, choice, genre, storyLength, characterArchetype, backstory, plotComplexity, tone, isAdultContent, customBasis, relationships, storyMilestones, isFinalChoice } = req.body;
  
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
    
    ${isFinalChoice ? `
    FINAL CHOICE & EPILOGUE DIRECTIVES:
    - This is the final choice of the story. You MUST end the story in this scene. Set "isEnding" to true.
    - Evaluate the player's journey, current milestones, and relationships to generate a fitting epilogue.
    - Output the ending type in "endingType" (e.g., 'Justice Served', 'Tragic Heartbreak', 'Fugitive').
    - Genre Templates: 
        - True Crime: Evaluate Suspicion vs Milestones (Evidence). High evidence/low suspicion -> Justice. High suspicion -> Fugitive/Caught.
        - Romance: Evaluate Affinity. >80 -> Commitment, 40-79 -> Friends, <30 -> Heartbreak.
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
    - choices: 2-3 significant paths forward (${isFinalChoice ? "leave array empty since it's the end" : "unless it is the end, then 0"}).
  `;

  const conversationHistory = history.map((node: any) => `Scene: ${node.sceneDescription}\nChoice taken: ${node.choiceTaken}`).join("\n---\n");
  const prompt = `
    STORY HISTORY:
    ${conversationHistory}
    
    USER ACTION: ${choice.text}
    ${choice.nextContext === 'user-defined-action' ? 'NOTE: This is a custom action from the user. React accordingly.' : `CONTEXT OF CHOICE: ${choice.nextContext}`}
    
    Now, generate the next scene.
  `;

  try {
    const response = await callGeminiWithRetry(() => getAI().models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: StoryNodeSchema
      }
    }));

    const data = JSON.parse(response.text!);
    apiCache.set(cacheKey, data);
    res.json(data);
  } catch (error: any) {
    console.error("Error continuing story:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/story/image", async (req, res) => {
  const { prompt, mood } = req.body;

  const cacheKey = getCacheKey("image", { prompt, mood });
  const cached = apiCache.get(cacheKey);
  if (cached) {
    console.log("Cache hit for image generation");
    return res.json(cached);
  }

  try {
    // Using gemini-3.1-flash-image-preview for high quality
    console.log("Generating image with prompt:", prompt);
    const response = await callGeminiWithRetry(() => getAI().models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: `Generate a high-quality atmospheric illustration for a ${mood} story. Style: Cinematographic, artistic, evocative. Scene: ${prompt}.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        },
      },
    }));

    console.log("Image generation response received.");
    if (!response.candidates || response.candidates.length === 0) {
      console.log("No candidates found in response structure:", JSON.stringify(response, null, 2));
    } else {
      for (const part of response.candidates[0]?.content?.parts || []) {
        if (part.inlineData) {
          console.log("Found image inline data");
          const data = { imageUrl: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}` };
          apiCache.set(cacheKey, data);
          return res.json(data);
        }
      }
      console.log("No inline data found in parts:", JSON.stringify(response.candidates[0]?.content?.parts));
    }
    
    res.status(404).json({ error: "No image generated" });
  } catch (error: any) {
    console.error("Error generating image:", error);
    res.status(500).json({ error: error.message });
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
