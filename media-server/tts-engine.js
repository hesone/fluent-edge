/**
 * tts-engine.js
 *
 * Piper TTS synthesis. English, German, French, Spanish, Farsi.
 * One Piper voice per language — see PIPER_VOICE_MAP below; each entry can be
 * overridden with a PIPER_VOICE_<LANG> environment variable.
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PIPER_BIN = process.env.PIPER_BIN || "piper";
const PIPER_VOICES_DIR = process.env.PIPER_VOICES_DIR || path.join(__dirname, "piper-voices");

const PIPER_VOICE_MAP = {
  en: process.env.PIPER_VOICE_EN || "en_US-lessac-medium.onnx",
  de: process.env.PIPER_VOICE_DE || "de_DE-thorsten-medium.onnx",
  fr: process.env.PIPER_VOICE_FR || "fr_FR-siwis-medium.onnx",
  es: process.env.PIPER_VOICE_ES || "es_ES-davefx-medium.onnx",
  fa: process.env.PIPER_VOICE_FA || "fa_IR-ganji-medium.onnx",
};

function piperSynth(text, lang) {
  return new Promise((resolve, reject) => {
    const voiceFile = path.join(PIPER_VOICES_DIR, PIPER_VOICE_MAP[lang]);

    if (!fs.existsSync(voiceFile)) {
      return reject(new Error(
        `Piper voice not found: ${voiceFile}. Run: piper --download-dir ${PIPER_VOICES_DIR} ` +
        `--update-voices --voice ${path.basename(voiceFile, ".onnx")}`
      ));
    }

    const chunks = [];
    const proc = spawn(PIPER_BIN, [
      "--model", voiceFile,
      "--output-raw",
      "--sentence-silence", "0.2",
      "--length-scale", "1"
    ]);

    proc.stdout.on("data", (c) => chunks.push(c));
    proc.stderr.on("data", (d) => { if (process.env.DEBUG) process.stderr.write(d); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`Piper exited with code ${code}`));
      resolve(Buffer.concat(chunks));
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

/**
 * Synthesise text to raw 16-bit PCM at TTS_SAMPLE_RATE.
 * Unsupported language codes fall back to English.
 *
 * NOTE: TTS_SAMPLE_RATE below must match the voices in PIPER_VOICE_MAP —
 * "-medium" models are 22050 Hz, "-low" and "-x_low" are 16000 Hz. The server
 * sends this value to the client in the tts_audio header, so changing the
 * voices to a different quality tier means changing it here too.
 */
export async function synthesise(text, lang) {
  if (!text || !text.trim()) throw new Error("Empty text");

  const safeLang = (lang || "en").toLowerCase().split("-")[0];

  if (!PIPER_VOICE_MAP[safeLang]) {
    console.warn(`[tts-engine] Unsupported lang "${lang}", falling back to English`);
    return piperSynth(text, "en");
  }

  return piperSynth(text, safeLang);
}

export const TTS_SAMPLE_RATE = 22050;