import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeAiResponse, AI_LIMITS } from './src/lib/aiGuard';

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
      const { prompt, currentState, model } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
      }

      const response = await ai.models.generateContent({
        model: model || "gemini-3.8-flash",
        contents: [{ role: 'user', parts: [{ text: typeof prompt === 'string' ? prompt : JSON.stringify(prompt) }] }],
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
          For "command" type, data can contain keys like "carrierFreq", "modFreq", "masterVolume", "mode", "ch" ('left' | 'right' | 'both'), etc.

          HARD LIMITS (enforced in code; values outside them are clamped or discarded):
          - carrierFreq / startCarrierFreq / endCarrierFreq: ${AI_LIMITS.carrierFreq.min}-${AI_LIMITS.carrierFreq.max} Hz
          - modFreq / startModFreq / endModFreq: ${AI_LIMITS.modFreq.min}-${AI_LIMITS.modFreq.max} Hz
          - masterVolume, modDepth, carrierMorph, startIntensity, endIntensity: 0.0-1.0
          - carrierPhase: 0-360 degrees; bpm / masterBpm: ${AI_LIMITS.bpm.min}-${AI_LIMITS.bpm.max}
          - mode: one of continuous | burst | sequenced | sweep
          - Protocols: at most ${AI_LIMITS.maxSegmentsPerChannel} segments per channel, each ${AI_LIMITS.segmentDurationSec.min}-${AI_LIMITS.segmentDurationSec.max} s, total at most ${AI_LIMITS.maxProtocolSec} s per channel. The final segment of every channel should end at intensity 0.
          - You may set "power": false to stop output. You may NEVER turn power on; "power": true is ignored. Protocols you return are only staged; the user starts them.`,
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

      let parsed: unknown = {};
      try {
        parsed = JSON.parse(response.text || '{}');
      } catch {
        parsed = { message: 'Co-pilot returned malformed output; nothing was applied.', type: 'analysis' };
      }
      const safe = sanitizeAiResponse(parsed);
      if (safe.report.dropped.length || safe.report.adjusted.length) {
        console.warn('AI guard:', safe.report);
      }
      res.json({ message: safe.message, type: safe.type, data: safe.data, guard: safe.report });
    } catch (error: any) {
      console.error('AI Command Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // TTS Endpoint
  app.post('/api/ai/tts', async (req, res) => {
    try {
      const { text, voice, model } = req.body;
      if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.json({ audio: null }); // Or return a 400, but silence is often better for TTS fallback
      }

      const response = await ai.models.generateContent({
        model: model || "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [{ text: text.trim(), speechMetadata: { style: "Calm, clinical, professional laboratory assistant" } }],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice || "Kore" },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        console.warn('TTS: No audio data returned from Gemini');
      }
      res.json({ audio: base64Audio || null });
    } catch (error: any) {
      console.error('TTS Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // STT Endpoint
  app.post('/api/ai/stt', async (req, res) => {
    try {
      const { audio, model } = req.body; // base64 webm/wav
      if (!audio) {
        return res.status(400).json({ error: 'Missing audio data' });
      }

      const response = await ai.models.generateContent({
        model: model || "gemini-3.5-transcribe",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "audio/webm", data: audio } },
              { text: "Transcribe this voice command for a stimulation system. Only return the transcribed text." }
            ]
          }
        ],
      });

      res.json({ text: response.text || "" });
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
