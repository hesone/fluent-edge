/**
 * Combined STT + TTS WebSocket bridge.
 *
 * STT: Whisper.cpp streaming bridge (unchanged from original).
 *   Receives Float32 PCM @16kHz over WebSocket, buffers ~2s windows,
 *   runs whisper.cpp CLI, returns { text, final }.
 *
 * TTS: Piper synthesis, requested via a typed JSON message.
 *   { type: "tts", text, lang } → server replies with
 *   { type: "tts_audio" } followed immediately by one binary frame
 *   containing raw 16-bit PCM @22050Hz.
 *
 * Binary frames are directional, not self-describing:
 *   client → server binary = mic PCM (Float32, STT input)
 *   server → client binary = synthesized speech (Int16 PCM, TTS output)
 *
 * Prereq:
 *   Whisper — build whisper.cpp and download a model (see README).
 *     WHISPER_BIN=/path/to/whisper.cpp/main
 *     WHISPER_MODEL=/path/to/models/ggml-base.en.bin
 *   Piper — pip install piper-tts, download voice models (see README).
 *     PIPER_BIN=piper
 *     PIPER_VOICES_DIR=/path/to/voices
 */
import { WebSocketServer } from "ws";
import { transcribe, cleanWhisperTranscript, SR, WINDOW_SEC } from "./stt-engine.js";
import { synthesise } from "./tts-engine.js";

const PORT = process.env.PORT || 9090;

const wss = new WebSocketServer({ port: PORT });
console.log(`🎤🔊 Media WS server (STT + TTS) on ws://localhost:${PORT}`);

function sendError(ws, source, err) {
  ws.send(JSON.stringify({ type: "error", source, message: err.message || String(err) }));
}

// ─── STT — unchanged behavior, just wrapped per-connection ─────────────────

function createSTTSession(ws) {
  let buffer = new Float32Array(0);
  let language = "auto";
  const windowSize = Math.floor(WINDOW_SEC * SR);

  function handleConfig(msg) {
    language = msg.language || "auto";
  }

  function handleEof() {
    if (buffer.length > SR * 0.3) {
      const text = cleanWhisperTranscript(transcribe(buffer, language));
      ws.send(JSON.stringify({ text, final: true }));
      buffer = new Float32Array(0);
    }
  }

  function handlePCM(data) {
    const incoming = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);
    const merged = new Float32Array(buffer.length + incoming.length);
    merged.set(buffer);
    merged.set(incoming, buffer.length);
    buffer = merged;

    if (buffer.length >= windowSize) {
      const chunk = buffer.slice(0, windowSize);
      buffer = buffer.slice(windowSize - SR * 0.3); // keep small overlap
      const text = cleanWhisperTranscript(transcribe(chunk, language));
      if (text) ws.send(JSON.stringify({ text, final: true }));
    }
  }

  function reset() {
    buffer = new Float32Array(0);
  }

  return { handleConfig, handleEof, handlePCM, reset };
}

// ─── TTS — single request/response, no per-connection state needed ─────────

async function handleTTSRequest(ws, msg) {
  try {
    const pcm = await synthesise(msg.text, msg.lang);
    ws.send(JSON.stringify({ type: "tts_audio" }));
    ws.send(pcm, { binary: true });
  } catch (err) {
    sendError(ws, "tts", err);
  }
}

// ─── Connection wiring ───────────────────────────────────────────────────────

wss.on("connection", (ws) => {
  const stt = createSTTSession(ws);

  ws.on("message", (data, isBinary) => {
    // Binary frame → always mic PCM, routed straight to STT.
    if (isBinary) {
      stt.handlePCM(data);
      return;
    }

    // JSON text frame → routed by shape.
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === "config") {
      stt.handleConfig(msg);
      return;
    }

    if (msg.type === "tts") {
      handleTTSRequest(ws, msg);
      return;
    }

    if (msg.eof) {
      stt.handleEof();
      return;
    }
  });

  ws.on("close", () => stt.reset());
});