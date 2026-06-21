// Client to the local Piper/TTS WebSocket server.
// Sends { type: "tts", text, lang }; receives a { type: "tts_audio" }
// header followed immediately by one binary frame of raw 16-bit PCM.

const WS_URL = process.env.NEXT_PUBLIC_STT_WS_URL ?? "ws://localhost:9090";

const SAMPLE_RATE: Record<string, number> = {
  en: 22050,
  de: 22050,
  fr: 22050,
  es: 22050,
};

export class TTSClient {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private url: string;

  // Resolves/rejects the in-flight speak() call once the audio frame arrives
  private pending: { resolve: () => void; reject: (e: Error) => void } | null = null;
  private expectingAudioFrame = false;
  private pendingLang = "en";
  private pendingOnPlaybackStart?: (durationSecs: number, startedAt: number) => void;
  private requestToken = 0;

  constructor(url = WS_URL) {
    this.url = url;
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

      ws.onerror = () => reject(new Error("TTS WS failed"));

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
        const onPlaybackStart = this.pendingOnPlaybackStart;

        // Capture resolve/reject NOW, before nulling this.pending below.
        // (Bug fixed here: the old code read `this.pending?.resolve()`
        // inside playPCM's .then() callback, which runs on a later
        // microtask — by then `this.pending = null` two lines down had
        // already executed, so `this.pending?.resolve()` silently did
        // nothing and the caller's speak() promise hung forever. This
        // is the actual root cause of onDone never firing.)
        const settlers = this.pending;

        if (token === this.requestToken) this.pending = null;

        this.playPCM(ev.data, this.pendingLang, onPlaybackStart).then(
          () => { if (token === this.requestToken) settlers?.resolve(); },
          (err) => { if (token === this.requestToken) settlers?.reject(err); }
        );
      }
      return;
    }

    // JSON text frame.
    let msg: any;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }

    if (msg.type === "tts_audio") {
      this.expectingAudioFrame = true;
      return;
    }

    if (msg.type === "error") {
      this.expectingAudioFrame = false;
      this.pending?.reject(new Error(msg.message ?? "TTS server error"));
      this.pending = null;
    }
  }

  /**
   * Returns the AudioContext used for playback, creating it if needed.
   * Exposed so callers can read `.currentTime` against the same clock
   * used by onPlaybackStart's `startedAt` value.
   */
  getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === "closed") {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private decodePCM(pcm: ArrayBuffer, lang: string): AudioBuffer {
    const ctx = this.getAudioContext();
    const sampleRate = SAMPLE_RATE[lang.split("-")[0]] ?? 22050;
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
    onPlaybackStart?: (durationSecs: number, startedAt: number) => void
  ): Promise<void> {
    const ctx = this.getAudioContext();
    const buffer = this.decodePCM(pcm, lang);

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
      onPlaybackStart?.(buffer.duration, startedAt);
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

  /**
   * Synthesise and play text. Resolves when playback finishes.
   * Cancels any TTS already in flight or playing.
   *
   * @param onPlaybackStart  Optional. Called the instant playback begins,
   *   with the audio's duration (seconds) and the AudioContext.currentTime
   *   it started at. Use these two numbers to drive a drift-free rAF loop
   *   for word-by-word highlighting — see TTSSentence.tsx for an example.
   */
  async speak(
    text: string,
    lang = "en",
    onPlaybackStart?: (durationSecs: number, startedAt: number) => void
  ): Promise<void> {
    this.stop();

    // Claim this request's token BEFORE the async connect() call below.
    // This closes a race where calling speak() again while a previous
    // call is still inside `await this.connect()` would silently
    // overwrite `this.pending` once that previous call finally resolved
    // connect() and got around to setting it — orphaning its promise
    // forever (it would never resolve OR reject, so any code awaiting
    // it, including a caller's finally{} block, would hang indefinitely).
    const token = ++this.requestToken;

    const ws = await this.connect();

    // If another speak() call came in while we were connecting, this
    // request is stale — bail out without touching `this.pending`,
    // which by now belongs to that newer call.
    if (token !== this.requestToken) {
      throw new Error("TTS cancelled");
    }

    this.pendingLang = lang;
    this.pendingOnPlaybackStart = onPlaybackStart;

    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      ws.send(JSON.stringify({ type: "tts", text, lang }));
    });
  }

  connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Stop playback immediately and cancel any pending request.
   * Does not close the WebSocket — call speak() again freely after this.
   */
  stop() {
    this.stopPlayback();
    this.expectingAudioFrame = false;
    // Invalidate any request still inside connect() — see the comment
    // in speak() for why this matters even when this.pending is null.
    this.requestToken++;
    if (this.pending) {
      this.pending.reject(new Error("TTS cancelled"));
      this.pending = null;
    }
  }

  /**
   * Fully tear down — closes the WebSocket and AudioContext.
   * Call this on unmount, not between individual speak() calls.
   */
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