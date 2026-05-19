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

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
    mood: { type: Type.STRING, enum: ["romance", "noir", "thriller", "mystery", "occult", "ethereal"] }
  },
  required: ["sceneTitle", "sceneDescription", "imagePrompt", "mediaType", "choices", "mood"]
};

// API routes
app.post("/api/story/start", async (req, res) => {
  const { genre } = req.body;
  
  const systemInstruction = `
    You are a master storyteller specializing in interactive fiction for an adult audience.
    Your task is to start a compelling choose-your-own-adventure story in the genre: ${genre}.
    
    If Romance: focus on emotional subtext, tension, longing, and atmospheric chemistry. Avoid clichés; focus on complex feelings.
    If True Crime/Noir: focus on grit, moral ambiguity, suspense, and the "unreliable narrator" vibe.
    If Paranormal Romance/Occult: focus on the "Universe Sea"—a vast, hidden dimension of ancient cosmic forces. 
    Themes: Supernatural entities such as vampires (blood bonds, immortality), fated-shifters (pack dynamics, animal instincts), fallen angels (celestial battles), and hereditary witches (covens, spellwork).
    CORE ELEMENTS: The romance is central. Focus on "fated mates," ancient blood feuds, and high stakes where external magic creates romantic tension.
    Style: Occult Indie Book vibes—mysterious, ethereal, forbidden love, and intricate hidden-society world-building.
    
    GUIDELINES:
    1. The scene description should be immersive (use sensory details like the smell of ozone, the shimmering veil, or the weight of a gaze across a dimensional rift).
    2. Provide 2-3 distinct choices that lead the character towards discovery, romantic bonding, or supernatural danger.
    3. Return the imagePrompt as a high-detail artistic description.
    4. Set mediaType to "video" only for the most cinematic moments (roughly 1 in 4 scenes). Otherwise "image".
  `;

  try {
    const response = await ai.models.generateContent({
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
  const { history, choice, genre } = req.body;
  
  const systemInstruction = `
    You are a master storyteller. Continue the interactive story based on the user's choice.
    Genre: ${genre}.
    
    GUIDELINES:
    1. Maintain tone and pace. Escalate the tension or emotional stakes.
    2. Reference previous events naturally if applicable.
    3. Ensure the next set of choices feels consequential.
    4. Provide a rich imagePrompt matching the mood of the new scene.
    5. Set mediaType to "video" only for the most dramatic highlights (rarely).
  `;

  const conversationHistory = history.map((node: any) => `Scene: ${node.sceneDescription}\nChoice taken: ${node.choiceTaken}`).join("\n---\n");
  const prompt = `
    STORY HISTORY:
    ${conversationHistory}
    
    USER CHOICE: ${choice.text}
    CONTEXT OF CHOICE: ${choice.nextContext}
    
    Now, generate the next scene.
  `;

  try {
    const response = await ai.models.generateContent({
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
    const response = await ai.models.generateContent({
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
    const operation = await ai.models.generateVideos({
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
    const updated = await ai.operations.getVideosOperation({ operation: op });
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
    const updated = await ai.operations.getVideosOperation({ operation: op });
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
