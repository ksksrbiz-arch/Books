import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

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
    intensity: { type: Type.NUMBER, description: "A value from 1 to 5 representing the tension or emotional intensity of the scene." }
  },
  required: ["sceneTitle", "sceneDescription", "imagePrompt", "mediaType", "choices", "mood", "intensity"]
};

// API routes
app.post("/api/story/start", async (req, res) => {
  const { genre, storyLength, characterArchetype, backstory, plotComplexity, tone, isAdultContent, customBasis } = req.body;
  
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
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Start the first scene of the adventure.",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: StoryNodeSchema
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Error starting story:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/story/continue", async (req, res) => {
  const { history, choice, genre, storyLength, characterArchetype, backstory, plotComplexity, tone, isAdultContent, customBasis } = req.body;
  
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
    
    CONTINUATION DIRECTIVES:
    1. PERSISTENCE: Maintain consistent character voices, physical locations, and established stakes.
    2. CONSEQUENCE: Every choice must feel like it pushes the character closer to or further from their goals, with tangible ripples in the world.
    3. SHOW, DON'T TELL: Use evocative, visceral prose. 
    ${isAdultContent ? '4. ADULT CONTENT (18+): Maintain the explicit detail and mature intensity in descriptions of intimacy, conflict, and internal struggle.' : '4. CHARACTER INTERNALITY: Describe the character\'s internal monologue or physiological reactions to the unfolding events.'}
    5. PACING: Escalate the tension or deepen the intimacy/mystery as appropriate for the story's progress.
    6. FREEFORM INPUTS: If the user provides a custom action instead of a preset choice, interpret their intent creatively and logically within the story's world.
    
    JSON STRUCTURE REQUIREMENTS:
    - Return the exact same JSON format as the start.
    - sceneDescription: 3-4 paragraphs of dense, literary prose.
    - choices: 2-3 significant paths forward.
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
    const response = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: StoryNodeSchema
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Error continuing story:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/story/image", async (req, res) => {
  const { prompt, mood } = req.body;

  try {
    // Using gemini-2.5-flash-image for speed
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash-image',
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
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return res.json({ imageUrl: `data:image/png;base64,${part.inlineData.data}` });
      }
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
    const operation = await getAI().models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: `Cinematic, atmospheric, artistic movement: ${prompt}. Slow motion, high fidelity.`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });
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
    const updated = await getAI().operations.getVideosOperation({ operation: op });
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
    const updated = await getAI().operations.getVideosOperation({ operation: op });
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
