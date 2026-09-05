// Text-to-speech adapter contract.
//
// Two engines with very different shapes sit behind this:
//
//   Piper (local)      synthesises the whole utterance up front and hands back
//                      a PCM buffer, so the exact duration and a sample-accurate
//                      AudioContext clock are known before playback starts.
//   Web Speech (online) streams from the OS voice with no duration available,
//                      but many voices emit word-boundary events as they go.
//
// Rather than force one into the other's shape, `onStart` carries whatever the
// engine actually knows. TTSSentences.tsx then drives the karaoke highlight
// from the best signal available:
//
//   duration + clock present → exact rAF interpolation against that clock
//   onWord events arriving   → exact, wins over any estimate
//   neither                  → self-calibrating estimate (see the component)

import type { TTSProvider } from "../config";

export interface TTSPlaybackInfo {
  /** Total length in seconds, when the engine knows it up front (Piper). */
  durationSecs?: number;
  /**
   * Reads "now" in the same time base the playback was scheduled on, in
   * seconds. Piper supplies the AudioContext clock, which does not drift
   * against the audio the way performance.now() can. Absent for engines that
   * don't schedule their own playback.
   */
  clock?: () => number;
  /** Value of clock() at the instant playback began. */
  startedAt?: number;
}

export interface TTSSpeakHandlers {
  /** Fired the moment audio starts, with whatever timing the engine knows. */
  onStart?: (info: TTSPlaybackInfo) => void;
  /** Fired at each word boundary with the character offset into `text`.
   *  Only some Web Speech voices emit these; Piper never does. */
  onWord?: (charIndex: number) => void;
  /** Fired when playback finishes or is cancelled. */
  onEnd?: () => void;
}

export interface TTSAdapter {
  readonly provider: TTSProvider;
  /** True when this engine reports its own word boundaries. */
  readonly hasWordBoundaries: boolean;

  isSupported(): boolean;

  /** Synthesise and play. Resolves when playback finishes. Cancels anything
   *  already in flight. */
  speak(text: string, lang: string, handlers: TTSSpeakHandlers): Promise<void>;

  /** Stop playback and cancel any pending request. Safe to speak() again. */
  stop(): void;

  /** Full teardown — call on unmount, not between speak() calls. */
  close(): void;
}
