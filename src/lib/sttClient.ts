// Browser Web Speech API speech-to-text client.
//
// Drop-in replacement for the old Whisper.cpp WebSocket streaming client:
// same public surface (constructor(onResult), start, stop, connected) so the
// consuming component barely changes. Recognition runs entirely in the
// browser via the Web Speech `SpeechRecognition` API — no media server, no
// model files. Supported in Chromium browsers (Chrome / Edge). Firefox has no
// SpeechRecognition; Safari support is partial.

export type SpeechHandler = (text: string, isFinal: boolean) => void;

// App language code → BCP-47 tag understood by SpeechRecognition.
const LANG_MAP: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  fa: "fa-IR",
};

function toBCP47(language: string): string {
  const base = (language || "en").toLowerCase().split("-")[0];
  return LANG_MAP[base] ?? language ?? "en-US";
}

// The constructor is vendor-prefixed in Chromium. No DOM lib types ship for it.
type SpeechRecognitionLike = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function getRecognitionCtor(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||      // eslint-disable-line @typescript-eslint/no-explicit-any
    (window as any).webkitSpeechRecognition || // eslint-disable-line @typescript-eslint/no-explicit-any
    null
  );
}

export class SpeechStream {
  private recognition: SpeechRecognitionLike | null = null;
  private onResult: SpeechHandler;
  private running = false;
  private manualStop = false;
  private language = "en-US";

  constructor(onResult: SpeechHandler) {
    this.onResult = onResult;
  }

  /** True if this browser exposes the Web Speech recognition API. */
  static isSupported(): boolean {
    return getRecognitionCtor() !== null;
  }

  /**
   * Begin recognition. `stream` is accepted for signature compatibility with
   * the old WhisperStream but is ignored — SpeechRecognition opens the mic
   * itself.
   */
  async start(_stream: MediaStream | null, config: { language: string }) {
    const Ctor = getRecognitionCtor();
    if (!Ctor) throw new Error("SpeechRecognition not supported in this browser");

    // If already running, tear down the previous instance first.
    if (this.recognition) this.stop();

    this.language = toBCP47(config.language);

    const rec: SpeechRecognitionLike = new Ctor();
    rec.lang = this.language;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const txt = result[0]?.transcript ?? "";
        if (result.isFinal) final += txt;
        else interim += txt;
      }
      // Commit finals first (caller appends them), then preview interim.
      if (final.trim()) this.onResult(final.trim(), true);
      if (interim.trim()) this.onResult(interim.trim(), false);
    };

    rec.onerror = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // "no-speech" / "aborted" are routine; only surface real failures.
      if (e?.error && e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("SpeechRecognition error:", e.error);
      }
    };

    rec.onend = () => {
      // Chrome ends the session after a stretch of silence. Restart it
      // automatically unless the caller explicitly asked to stop.
      if (this.running && !this.manualStop) {
        try {
          rec.start();
        } catch {
          /* start() throws if it's mid-transition; safe to ignore */
        }
      } else {
        this.running = false;
      }
    };

    this.recognition = rec;
    this.manualStop = false;
    this.running = true;
    rec.start();
  }

  connected() {
    return this.running;
  }

  stop() {
    this.manualStop = true;
    this.running = false;
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.stop();
      } catch {
        /* ignore */
      }
      this.recognition = null;
    }
  }
}
