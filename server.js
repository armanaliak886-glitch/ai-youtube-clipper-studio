import express from "express";
import helmet from "helmet";
import multer from "multer";
import ffmpegPath from "ffmpeg-static";
import { GoogleGenAI } from "@google/genai";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const UPLOAD_DIR = path.join(__dirname, "uploads");
const OUTPUT_DIR = path.join(__dirname, "outputs");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/outputs", express.static(OUTPUT_DIR, { maxAge: "1h" }));

const maxMb = Number(process.env.MAX_UPLOAD_MB || 500);
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"].includes(file.mimetype);
    cb(ok ? null : new Error("Please upload an MP4, MOV, WebM, or MKV video."), ok);
  }
});

function getApiKey(req) {
  // The key is used only for this request and is never written to disk or logged.
  return (req.get("x-gemini-api-key") || process.env.GEMINI_API_KEY || "").trim();
}
function aiClient(req) {
  const apiKey = getApiKey(req);
  if (!apiKey) throw new Error("Add your Google AI Studio API key in API Connector first.");
  return new GoogleGenAI({ apiKey });
}
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args);
    let stderr = "";
    child.stderr.on("data", d => { stderr += d.toString(); });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(stderr.slice(-1800) || "FFmpeg failed.")));
  });
}
function safeUnlink(file) {
  if (file) fs.promises.unlink(file).catch(() => {});
}
function cleanJson(text) {
  const raw = (text || "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("AI response was not valid JSON. Try again.");
  return JSON.parse(raw.slice(start, end + 1));
}

app.get("/api/health", (_req, res) => res.json({
  ok: true,
  keyConfiguredOnServer: Boolean(process.env.GEMINI_API_KEY),
  maxUploadMb: maxMb
}));

app.post("/api/analyze", upload.single("video"), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a video file first." });
    const ai = aiClient(req);
    let uploaded = await ai.files.upload({
      file: filePath,
      config: { mimeType: req.file.mimetype || "video/mp4" }
    });
    for (let i = 0; i < 60 && uploaded.state?.toString() === "PROCESSING"; i++) {
      await new Promise(r => setTimeout(r, 3000));
      uploaded = await ai.files.get({ name: uploaded.name });
    }
    if (uploaded.state?.toString() === "FAILED") throw new Error("Gemini could not process this video.");
    const prompt = `Analyze this user-provided video and return ONLY valid JSON.
Create a useful short-form editing plan. Do not invent events or quotes.
Schema:
{
 "summary":"short summary",
 "clips":[{"title":"short hook title","start":0,"end":30,"reason":"why this moment works"}],
 "captions":[{"start":0,"end":3.2,"text":"spoken words or concise accurate caption"}],
 "transcript":"best-effort transcript"
}
Rules: timestamps are seconds from the start; clips must be within the video; propose up to 5 clips, each 15-60 seconds where possible; captions should be concise and time-aligned. If exact speech is unclear, say so in transcript rather than inventing words.`;
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const result = await ai.models.generateContent({
      model,
      contents: [{
        role: "user",
        parts: [
          { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } },
          { text: prompt }
        ]
      }]
    });
    const data = cleanJson(result.text);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || "Video analysis failed." });
  } finally {
    await safeUnlink(filePath);
  }
});

app.post("/api/clip", upload.single("video"), async (req, res) => {
  const input = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a video file first." });
    const start = Number(req.body.start);
    const end = Number(req.body.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > 600) {
      return res.status(400).json({ error: "Enter a valid clip range (maximum 10 minutes)." });
    }
    const id = crypto.randomUUID();
    const output = path.join(OUTPUT_DIR, `${id}.mp4`);
    await runFfmpeg(["-y", "-ss", String(start), "-i", input, "-t", String(end - start),
      "-map", "0:v:0?", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "veryfast",
      "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", output]);
    res.json({ url: `/outputs/${id}.mp4`, filename: `clip-${id.slice(0, 8)}.mp4` });
  } catch (err) {
    res.status(500).json({ error: err.message || "Clip export failed. Check that FFmpeg supports this file." });
  } finally {
    await safeUnlink(input);
  }
});

function pcmToWav(pcm, sampleRate = 24000, channels = 1) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22); header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28); header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

app.post("/api/dub", upload.single("video"), async (req, res) => {
  const input = req.file?.path;
  let wavPath;
  try {
    const text = String(req.body.text || "").trim();
    const targetLanguage = String(req.body.targetLanguage || "Hindi").slice(0, 40);
    if (!text) return res.status(400).json({ error: "Add a transcript or dubbing script first." });
    const ai = aiClient(req);
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const translated = await ai.models.generateContent({
      model,
      contents: `Translate this voiceover script into natural spoken ${targetLanguage}. Keep names and meaning accurate. Return only the translated script:\n\n${text}`
    });
    const script = (translated.text || "").trim();
    if (!script) throw new Error("Could not create the translated voiceover script.");
    const tts = await ai.models.generateContent({
      model: process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read aloud in a clear, natural, friendly narration voice:\n${script}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }
      }
    });
    const audioPart = tts.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    if (!audioPart) throw new Error("The selected Gemini TTS model did not return audio. Check model access in AI Studio.");
    const pcm = Buffer.from(audioPart.inlineData.data, "base64");
    wavPath = path.join(OUTPUT_DIR, `${crypto.randomUUID()}.wav`);
    await fs.promises.writeFile(wavPath, pcmToWav(pcm));
    const wavName = path.basename(wavPath);
    if (input) {
      const id = crypto.randomUUID();
      const output = path.join(OUTPUT_DIR, `${id}-dubbed.mp4`);
      await runFfmpeg(["-y", "-i", input, "-i", wavPath, "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "copy", "-c:a", "aac", "-shortest", "-movflags", "+faststart", output]);
      res.json({ script, audioUrl: `/outputs/${wavName}`, videoUrl: `/outputs/${id}-dubbed.mp4` });
    } else {
      res.json({ script, audioUrl: `/outputs/${wavName}` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || "Dubbing generation failed." });
  } finally {
    await safeUnlink(input);
  }
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "Request failed." });
});

app.listen(PORT, () => console.log(`AI YouTube Clipper Studio running on port ${PORT}`));
