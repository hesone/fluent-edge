// Piper text-to-speech over the local media server — the "local" TTS adapter.
// Restored from the pre-server-migration implementation and fitted to the
// shared TTSAdapter interface.
//
// Protocol: send { type: "tts", text, lang }; the server replies with a
// { type: "tts_audio", sampleRate } header followed immediately by one binary
// frame of raw 16-bit PCM. Runs with no network connection at all. Start the
// server with:  npm run media
//
// The online counterpart is ./webSpeech.ts.

import { MEDIA_WS_URL } from "../config";
import type { TTSAdapter, TTSSpeakHandlers } from "./types";

// Fallback sample rates, used only when talking to an older media server that
// doesn't announce its own rate in the tts_audio header. Every Piper "-medium"
// voice is 22050 Hz; "-low" / "-x_low" models are 16000 Hz, and decoding one at
// the wrong rate plays it fast and sharp — which is why the server now tells us
// rather than us guessing.
const FALLBACK_SAMPLE_RATE: Record<string, number> = {
  en: 22050,
  de: 22050,
  fr: 22050,
  es: 22050,
  fa: 22050,
};
const DEFAULT_SAMPLE_RATE = 22050;

export class PiperTTS implements TTSAdapter {
  readonly provider = "piper" as const;
  /** Piper returns audio, not events — highlighting is interpolated from the
   *  known duration instead. */
  readonly hasWordBoundaries = false;

  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private url: string;

  // Resolves/rejects the in-flight speak() call once the audio frame arrives.
  private pending: { resolve: () => void; reject: (e: Error) => void } | null = null;
  private expectingAudioFrame = false;
  private pendingLang = "en";
  private pendingSampleRate: number | null = null;
  private pendingHandlers: TTSSpeakHandlers = {};
  private requestToken = 0;

  constructor(url = MEDIA_WS_URL) {
    this.url = url;
  }

  isSupported(): boolean {
    return typeof window !== "undefined" && typeof WebSocket !== "undefined";
  }

  private connect(): Promise<WebSocket> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve(this.ws);
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        this.ws = ws;
        resolve(ws);
      };

      ws.onerror = () => reject(new Error(`Media server did not answer at ${this.url}`));

      ws.onclose = () => {
        this.ws = null;
      };

      ws.onmessage = (ev) => this.handleMessage(ev);
    });
  }

  private handleMessage(ev: MessageEvent) {
    // Binary frame → the PCM payload that follows a tts_audio header.
    if (ev.data instanceof ArrayBuffer) {
      if (this.expectingAudioFrame) {
        this.expectingAudioFrame = false;
        const token = this.requestToken;
        const handlers = this.pendingHandlers;
        const sampleRate = this.pendingSampleRate;

        // Capture resolve/reject NOW, before nulling this.pending below.
        // (Bug fixed here originally: reading `this.pending?.resolve()` inside
        // playPCM's .then() callback runs on a later microtask — by then
        // `this.pending = null` two lines down has already executed, so the
        // caller's speak() promise hangs forever.)
        const settlers = this.pending;

        if (token === this.requestToken) this.pending = null;

        this.playPCM(ev.data, this.pendingLang, sampleRate, handlers).then(
          () => {
            if (token !== this.requestToken) return;
            handlers.onEnd?.();
            settlers?.resolve();
          },
          (err) => {
            if (token !== this.requestToken) return;
            handlers.onEnd?.();
            settlers?.reject(err);
          }
        );
      }
      return;
    }

    // JSON text frame.
    let msg: { type?: string; sampleRate?: number; message?: string };
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }

    if (msg.type === "tts_audio") {
      this.expectingAudioFrame = true;
      // Newer servers announce the rate; older ones don't, and we fall back.
      this.pendingSampleRate = typeof msg.sampleRate === "number" ? msg.sampleRate : null;
      return;
    }

    if (msg.type === "error") {
      this.expectingAudioFrame = false;
      const handlers = this.pendingHandlers;
      const settlers = this.pending;
      this.pending = null;
      handlers.onEnd?.();
      settlers?.reject(new Error(msg.message ?? "TTS server error"));
    }
  }

  /** The AudioContext playback is scheduled on — its clock is what the
   *  highlighting interpolates against. */
  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === "closed") {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private decodePCM(pcm: ArrayBuffer, lang: string, announced: number | null): AudioBuffer {
    const ctx = this.getAudioContext();
    const sampleRate =
      announced ?? FALLBACK_SAMPLE_RATE[lang.split("-")[0]] ?? DEFAULT_SAMPLE_RATE;
    const int16 = new Int16Array(pcm);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);
    return buffer;
  }

  private playPCM(
    pcm: ArrayBuffer,
    lang: string,
    announced: number | null,
    handlers: TTSSpeakHandlers
  ): Promise<void> {
    const ctx = this.getAudioContext();
    const buffer = this.decodePCM(pcm, lang, announced);

    this.stopPlayback();

    this.currentSource = ctx.createBufferSource();
    this.currentSource.buffer = buffer;
    this.currentSource.connect(ctx.destination);

    const startedAt = ctx.currentTime;

    return new Promise((resolve) => {
      this.currentSource!.onended = () => {
        this.currentSource = null;
        resolve();
      };
      this.currentSource!.start(startedAt);
      // Everything the component needs for drift-free word highlighting:
      // exact length, and the very clock the audio is scheduled on.
      handlers.onStart?.({
        durationSecs: buffer.duration,
        clock: () => ctx.currentTime,
        startedAt,
      });
    });
  }

  private stopPlayback() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // already stopped
      }
      this.currentSource = null;
    }
  }

  async speak(text: string, lang = "en", handlers: TTSSpeakHandlers = {}): Promise<void> {
    if (!text || !text.trim()) return;

    this.stop();

    // Claim this request's token BEFORE the async connect() below. This closes
    // a race where calling speak() again while a previous call is still inside
    // `await this.connect()` would silently overwrite `this.pending` once that
    // earlier call resolved — orphaning its promise forever (never resolving
    // OR rejecting, so any caller awaiting it, including a finally{} block,
    // would hang indefinitely).
    const token = ++this.requestToken;

    const ws = await this.connect();

    // If another speak() arrived while connecting, this request is stale —
    // bail out without touching `this.pending`, which now belongs to it.
    if (token !== this.requestToken) {
      throw new Error("TTS cancelled");
    }

    this.pendingLang = lang;
    this.pendingHandlers = handlers;
    this.pendingSampleRate = null;

    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      ws.send(JSON.stringify({ type: "tts", text, lang }));
    });
  }

  /** Whether audio is currently playing. */
  speaking(): boolean {
    return this.currentSource !== null;
  }

  connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  stop() {
    this.stopPlayback();
    this.expectingAudioFrame = false;
    // Invalidate any request still inside connect() — see speak() for why this
    // matters even when this.pending is null.
    this.requestToken++;
    if (this.pending) {
      this.pending.reject(new Error("TTS cancelled"));
      this.pending = null;
    }
    this.pendingHandlers = {};
  }

  close() {
    this.stop();
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
    this.audioCtx?.close();
    this.audioCtx = null;
  }
}
