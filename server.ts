import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // AI Command / Protocol Generation Endpoint
  app.post('/api/ai/command', async (req, res) => {
    try {
      const { prompt, currentState } = req.body;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are the AI Co-Pilot for the Signal Telemetry Profiler, a high-precision stimulation system.
          Current System State: ${JSON.stringify(currentState)}
          
          Your goal is to help the user manage, compose, and analyze stimulation protocols.
          You can return:
          1. A direct parameter update (e.g., change carrier frequency).
          2. A full StimulationProtocol object to be loaded.
          3. A textual explanation or analysis.
          
          Respond in JSON format with the following schema:
          {
            "message": "A textual message to the user explaining what you did or providing analysis",
            "type": "command" | "protocol" | "analysis",
            "data": { ... relevant data based on type ... }
          }
          
          For "protocol" type, data must be a StimulationProtocol object.
          For "command" type, data can contain keys like "carrierFreq", "modFreq", "masterVolume", "mode", "ch" ('left' | 'right' | 'both'), etc.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["command", "protocol", "analysis"] },
              data: { type: Type.OBJECT }
            },
            required: ["message", "type"]
          }
        }
      });

      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error('AI Command Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // TTS Endpoint
  app.post('/api/ai/tts', async (req, res) => {
    try {
      const { text } = req.body;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [{ text, speechMetadata: { style: "Calm, clinical, professional laboratory assistant" } }],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      res.json({ audio: base64Audio });
    } catch (error: any) {
      console.error('TTS Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // STT Endpoint
  app.post('/api/ai/stt', async (req, res) => {
    try {
      const { audio } = req.body; // base64 webm/wav
      const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            { inlineData: { mimeType: "audio/webm", data: audio } },
            { text: "Transcribe this voice command for a stimulation system. Only return the transcribed text." }
          ]
        },
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('STT Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const port = 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

createServer();
