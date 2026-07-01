// Browser Web Speech API text-to-speech client.
//
// Replaces the old Piper/WebSocket TTS path: synthesis now runs entirely in
// the browser via `speechSynthesis` — no media server, no voice model files.
// Voices come from the user's OS/browser, selected per locale. Word-boundary
// events drive the karaoke highlighting in TTSSentences.tsx.

import { toBCP47 } from "./i18n";

export interface SpeakHandlers {
  /** Fired when synthesis actually begins. */
  onStart?: () => void;
  /** Fired at each word boundary with the char offset into `text`. */
  onWord?: (charIndex: number) => void;
  /** Fired when playback finishes (or is cancelled). */
  onEnd?: () => void;
}

// Resolve the available voice list, waiting for it to populate if needed.
// `getVoices()` is often empty until the async `voiceschanged` event fires.
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const ready = synth.getVoices();
  if (ready.length) return Promise.resolve(ready);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: SpeechSynthesisVoice[]) => {
      if (settled) return;
      settled = true;
      synth.onvoiceschanged = null;
      resolve(v);
    };
    synth.onvoiceschanged = () => finish(synth.getVoices());
    // Fallback in case the event never fires.
    setTimeout(() => finish(synth.getVoices()), 600);
  });
}

// ─── Voice selection ─────────────────────────────────────────────────────────
//
// To change the voice, edit VOICE_PREFERENCES below. Each language lists voice
// names (case-insensitive substring match) in priority order — the first one
// found on the user's device wins. To see what's installed, run this in the
// browser console on the app page:
//
//   speechSynthesis.getVoices().forEach(v => console.log(v.name, v.lang, v.localService))
//
// Names differ per OS/browser (e.g. "Samantha"/"Daniel" on macOS,
// "Microsoft Aria"/"Google US English" on Windows/Chrome). List a few
// candidates per language so a match is likely on whatever machine runs it.
export const VOICE_PREFERENCES: Record<string, string[]> = {
  en: ["Nathan", "Zoe", "Evan", "Google US English", "Microsoft Aria", "Samantha", "Daniel"],
  de: ["Google Deutsch", "Microsoft Katja", "Anna"],
  fr: ["Google français", "Microsoft Denise", "Amelie", "Thomas"],
  es: ["Google español", "Microsoft Elvira", "Monica", "Jorge"],
  fa: ["Dariush", "Microsoft Dilara", "Google فارسی"],
};

// Heuristic quality score for when no preference matches: modern cloud/neural
// engines sound far better than the old built-in robotic voices.
function voiceQuality(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural|premium|enhanced/.test(name)) s += 6;
  if (name.includes("google")) s += 4;
  if (name.includes("microsoft")) s += 2;
  if (!v.localService) s += 1; // online voices tend to be higher quality
  return s;
}

// Best matching voice for a locale:
//   1. honour VOICE_PREFERENCES (priority order),
//   2. else the highest-quality voice for the language,
//   3. else any voice for the language.
async function pickVoice(locale: string): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices();
  const want = locale.toLowerCase();
  const base = want.split("-")[0];

  const forLang = voices.filter((v) =>
    v.lang?.toLowerCase().replace("_", "-").startsWith(base)
  );
  if (!forLang.length) return null;

  // 1. Preferred voice names for this language.
  for (const wanted of VOICE_PREFERENCES[base] ?? []) {
    const hit = forLang.find((v) => v.name.toLowerCase().includes(wanted.toLowerCase()));
    if (hit) return hit;
  }

  // 2. Highest-quality voice — prefer an exact locale match on ties.
  const exact = forLang.filter((v) => v.lang?.toLowerCase() === want);
  const pool = exact.length ? exact : forLang;
  return pool.slice().sort((a, b) => voiceQuality(b) - voiceQuality(a))[0] ?? null;
}

export class TTSClient {
  private current: SpeechSynthesisUtterance | null = null;

  /** True if this browser exposes the Web Speech synthesis API. */
  static isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /**
   * Synthesise and play `text`. Resolves when playback finishes. Cancels any
   * utterance already in flight.
   */
  async speak(text: string, lang = "en", handlers: SpeakHandlers = {}): Promise<void> {
    if (!TTSClient.isSupported()) throw new Error("SpeechSynthesis not supported in this browser");
    if (!text || !text.trim()) return;

    this.stop();

    const locale = toBCP47(lang);
    const voice = await pickVoice(locale);

    return new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = locale;
      if (voice) u.voice = voice;
      u.rate = 1;
      u.pitch = 1;

      u.onstart = () => handlers.onStart?.();

      u.onboundary = (e: SpeechSynthesisEvent) => {
        // Some engines tag sentence boundaries too; only act on words
        // (name is "word", or undefined on engines that don't report it).
        if (!e.name || e.name === "word") handlers.onWord?.(e.charIndex);
      };

      u.onend = () => {
        this.current = null;
        handlers.onEnd?.();
        resolve();
      };

      u.onerror = (e: SpeechSynthesisErrorEvent) => {
        this.current = null;
        // These fire when we cancel a previous utterance — treat as normal end.
        if (e.error === "interrupted" || e.error === "canceled") {
          handlers.onEnd?.();
          resolve();
          return;
        }
        reject(new Error("SpeechSynthesis error: " + e.error));
      };

      this.current = u;
      window.speechSynthesis.speak(u);
    });
  }

  /** Whether the engine is currently speaking. */
  speaking(): boolean {
    return TTSClient.isSupported() && window.speechSynthesis.speaking;
  }

  /** Stop playback immediately and cancel any pending utterance. */
  stop() {
    if (!TTSClient.isSupported()) return;
    if (this.current) {
      this.current.onend = null;
      this.current.onboundary = null;
      this.current.onerror = null;
      this.current.onstart = null;
      this.current = null;
    }
    window.speechSynthesis.cancel();
  }

  /** Full teardown. Same as stop() for the synthesis API. */
  close() {
    this.stop();
  }
}
