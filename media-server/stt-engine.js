/**
 * stt-engine.js
 *
 * Whisper.cpp transcription — extracted as-is from the original
 * server.js. No behavior changes: still spawnSync, still per-window
 * WAV file on disk, same cleanup regex pipeline.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const WHISPER_BIN = process.env.WHISPER_BIN || "./whisper.cpp/build/bin/whisper-cli";
const WHISPER_MODEL = process.env.WHISPER_MODEL || "./whisper.cpp/models/ggml-base.bin";

export const SR = 16000;
export const WINDOW_SEC = 2.0;

function floatToWav(float32, sampleRate) {
  const numSamples = float32.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);
  for (let i = 0; i < numSamples; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, 44 + i * 2);
  }
  return buffer;
}

export function transcribe(float32, language = "auto") {
  const wav = floatToWav(float32, SR);
  const tmp = path.join(os.tmpdir(), `whisper_${Date.now()}.wav`);
  fs.writeFileSync(tmp, wav);
  try {
    const args = [
      "-m", WHISPER_MODEL,
      "-f", tmp,
      "-nt",
      "-otxt",
      "-of", tmp,
    ];

    if (language !== "auto") {
      args.push("-l", language);
    }

    const res = spawnSync(
      WHISPER_BIN,
      args,
      { encoding: "utf-8" }
    );

    let text = "";
    try { text = fs.readFileSync(tmp + ".txt", "utf-8").trim(); } catch {}
    fs.existsSync(tmp + ".txt") && fs.unlinkSync(tmp + ".txt");
    return text || (res.stdout || "").trim();
  } catch (e) {
    console.error("transcribe error", e);
    return "";
  } finally {
    fs.existsSync(tmp) && fs.unlinkSync(tmp);
  }
}

export function cleanWhisperTranscript(text) {
  return text
    // remove bracket noise like [BLANK_AUDIO], [LAUGHTER]
    .replace(/\[[^\]]*?\]/g, "")
    // remove parenthesis noise like (laughing), (sighs), (door slams)
    .replace(/\([^)]*?\)/g, "")
    // remove leftover weird punctuation fragments
    .replace(/[-_]{2,}/g, "")
    // fix broken line breaks
    .replace(/\s*\n\s*/g, " ")
    // collapse multiple spaces
    .replace(/\s{2,}/g, " ")
    // remove spaces around punctuation
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\b(um+|uh+|erm+|like|you know)\b/gi, "")
    .trim();
}