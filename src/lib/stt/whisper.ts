// whisper.cpp speech-to-text over the local media server — the "local" STT
// adapter. Restored from the pre-server-migration implementation and fitted to
// the shared STTAdapter interface.
//
// Streams 16 kHz Float32 PCM up the media server's WebSocket; the server
// buffers ~2 s windows, runs whisper.cpp, and sends back { text, final }.
// Runs with no network connection at all. Start the server with:
//   npm run media
//
// The online counterpart is ./webSpeech.ts.

import { MEDIA_WS_URL } from "../config";
import type { STTAdapter, STTConfig, STTHandler } from "./types";

/** @deprecated kept as an alias so older imports keep compiling. */
export type WhisperHandler = STTHandler;

export class WhisperStream implements STTAdapter {
  readonly provider = "whisper" as const;
  /** whisper.cpp is fed audio by us, so the caller must supply the mic stream. */
  readonly needsStream = true;

  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private onResult: STTHandler;
  private url: string;

  constructor(onResult: STTHandler, url = MEDIA_WS_URL) {
    this.onResult = onResult;
    this.url = url;
  }

  /** WebSockets and AudioContext are everywhere; reachability of the media
   *  server is a separate question, answered by start() failing. */
  isSupported(): boolean {
    return typeof window !== "undefined" && typeof WebSocket !== "undefined";
  }

  async start(stream: MediaStream | null, config: STTConfig) {
    if (!stream) {
      throw new Error("Whisper STT needs a microphone MediaStream");
    }

    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";

    await new Promise<void>((resolve, reject) => {
      const ws = this.ws!;
      const timer = setTimeout(
        () => reject(new Error(`Media server did not answer at ${this.url}`)),
        4000
      );
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error("Media server WebSocket failed")); };
    });

    // whisper.cpp wants a plain ISO-639-1 code ("en", "de", "fa") — NOT the
    // BCP-47 tag the Web Speech API expects. Pass the app language through
    // untouched; toBCP47() must not be applied here.
    this.ws.send(JSON.stringify({ type: "config", language: config.language }));

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (typeof msg.text === "string") this.onResult(msg.text, !!msg.final);
      } catch {
        /* ignore malformed frames */
      }
    };

    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    this.source = this.audioCtx.createMediaStreamSource(stream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);

    this.processor.onaudioprocess = (e) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      // Float32 PCM straight through — the server converts.
      this.ws.send(e.inputBuffer.getChannelData(0).buffer.slice(0));
    };
  }

  connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * No-op. The stale-utterance problem reset() exists for is specific to the
   * Web Speech API, which re-delivers an accumulating interim result until it
   * finalises. whisper.cpp emits discrete windowed segments, so clearing the
   * caller's own transcript buffer is already sufficient.
   */
  reset() {
    /* intentionally empty — see doc comment */
  }

  stop() {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.audioCtx?.close();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ eof: true }));
    }
    this.ws?.close();
    this.ws = null;
    this.processor = null;
    this.source = null;
    this.audioCtx = null;
  }
}
