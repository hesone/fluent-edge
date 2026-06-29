/**
 * TTS WebSocket server.
 *
 * STT was removed — speech-to-text now runs in the browser via the Web Speech
 * API (see src/lib/sttClient.ts), so this server only handles synthesis.
 *
 * TTS: Piper synthesis, requested via a typed JSON message.
 *   { type: "tts", text, lang } → server replies with
 *   { type: "tts_audio" } followed immediately by one binary frame
 *   containing raw 16-bit PCM @22050Hz.
 *
 * Prereq:
 *   Piper — pip install piper-tts, download voice models (see README).
 *     PIPER_BIN=piper
 *     PIPER_VOICES_DIR=/path/to/voices
 */
import { WebSocketServer } from "ws";
import { synthesise } from "./tts-engine.js";

const PORT = process.env.PORT || 9090;

const wss = new WebSocketServer({ port: PORT });
console.log(`🔊 TTS WS server on ws://localhost:${PORT}`);

function sendError(ws, source, err) {
  ws.send(JSON.stringify({ type: "error", source, message: err.message || String(err) }));
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
  ws.on("message", (data, isBinary) => {
    // No binary frames are expected anymore (mic PCM used to arrive here).
    if (isBinary) return;

    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === "tts") {
      handleTTSRequest(ws, msg);
    }
  });
});
