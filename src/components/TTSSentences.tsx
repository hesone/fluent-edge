"use client";

import { useEffect, useRef, useCallback, useState, useImperativeHandle, Ref } from "react";
import { createTTS } from "@/lib/tts";
import type { TTSAdapter } from "@/lib/tts";

// Karaoke highlighting has to work over two very different engines:
//
//   Piper (local)       hands back a finished PCM buffer, so the exact duration
//                       and the AudioContext clock it is scheduled on are known
//                       before the first sample plays. Highlighting is an
//                       interpolation against that clock — no drift.
//   Web Speech (online) reports no duration at all. Some voices emit word
//                       boundary events; many (Chrome's network "Google"
//                       voices) emit none.
//
// So the component runs one estimated timer that always works, and lets better
// information override it as it arrives: a real duration from the engine
// replaces the estimate before playback starts, and real boundary events
// replace the timer entirely once they show up. When neither is available, the
// estimate self-calibrates from how long previous utterances actually took.

// ─── Word spans ──────────────────────────────────────────────────────────────

interface WordSpan {
  word: string;
  start: number; // char offset of the word's first character in `text`
  end: number;   // char offset just past the word's last character
}

// Split text into whitespace-delimited words, keeping each word's character
// offsets so a SpeechSynthesis boundary `charIndex` can be mapped to a word.
// The ordering/count matches `text.split(/\s+/).filter(Boolean)` used to render.
function computeWordSpans(text: string): WordSpan[] {
  const spans: WordSpan[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    spans.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  }
  return spans;
}

// Index of the word containing (or most recently started before) a char offset.
function wordIndexAt(spans: WordSpan[], charIndex: number): number {
  let idx = -1;
  for (let i = 0; i < spans.length; i++) {
    if (charIndex >= spans[i].start) idx = i;
    else break;
  }
  return idx;
}

// ─── Duration estimation & self-calibration ──────────────────────────────────

// Approx characters spoken per second at rate=1 — the starting guess before the
// engine's real rate has been measured. Only used for engines that report
// neither a duration nor boundary events.
const CHARS_PER_SEC = 13;

// The Web Speech API won't tell us an utterance's duration up front, but we can
// time how long each one actually takes and learn from it:
//   • `measuredCharsPerSec` — a running estimate of this engine's speaking rate,
//     so the first highlight of any new text is close and gets better.
//   • `durationCache` — the exact measured duration per text, so replaying the
//     same answer (common in Study mode) highlights in near-perfect sync.
// Module-level so calibration persists across component instances/questions.
// Piper never feeds this: it reports its true duration, so there is nothing to
// learn and nothing that could skew the estimate for the other engine.
let measuredCharsPerSec = CHARS_PER_SEC;
const durationCache = new Map<string, number>();

function estimatedDuration(text: string): number {
  const cached = durationCache.get(text);
  if (cached) return cached;
  return Math.max(text.length / measuredCharsPerSec, 0.4);
}

// Fold a freshly measured utterance into the calibration (outliers ignored —
// e.g. a playback the user stopped early).
function recordMeasurement(text: string, durationSecs: number) {
  if (durationSecs < 0.3 || !text.length) return;
  const cps = text.length / durationSecs;
  if (cps < 4 || cps > 35) return; // implausible → likely interrupted
  durationCache.set(text, durationSecs);
  measuredCharsPerSec = measuredCharsPerSec * 0.7 + cps * 0.3; // smooth
}

// Distribute a total duration across words by length, with extra weight on
// punctuation pauses.
function estimateWordTimings(
  words: string[],
  durationSecs: number
): { start: number; end: number }[] {
  if (!words.length || durationSecs <= 0) return [];
  const weightOf = (w: string) => {
    const base = Math.max(w.replace(/[^\p{L}\p{N}]/gu, "").length, 1);
    if (/[.!?]["'”’)\]]*$/.test(w)) return base + 4;  // sentence end — longer pause
    if (/[,;:—–-]["'”’)\]]*$/.test(w)) return base + 2; // clause break — shorter pause
    return base;
  };
  const weights = words.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = 0;
  return weights.map((wt) => {
    const dur = (wt / total) * durationSecs;
    const start = cursor;
    cursor += dur;
    return { start, end: cursor };
  });
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseTTSOptions {
  text: string;
  lang?: string;
  onDone?: () => void;
}

// A word must stay lit at least this long before the next one takes over, so
// that words skipped by a slow frame still get a visible beat each instead of
// being collapsed into their successor by React's state batching.
const MIN_BOUNCE_MS = 60;

function useTTS({ text, lang = "en", onDone }: UseTTSOptions) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);

  // One adapter instance per component, created lazily (the provider may need
  // a probe to resolve), torn down on unmount.
  const clientRef = useRef<TTSAdapter | null>(null);
  const rafRef = useRef<number | null>(null);
  const bounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  async function getClient(): Promise<TTSAdapter> {
    if (!clientRef.current) clientRef.current = await createTTS();
    return clientRef.current;
  }

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const cancelTimers = useCallback(() => {
    cancelRaf();
    if (bounceRef.current !== null) {
      clearTimeout(bounceRef.current);
      bounceRef.current = null;
    }
  }, [cancelRaf]);

  const play = useCallback(async () => {
    if (!text) return;

    const client = await getClient();
    if (!client.isSupported()) return;

    const spans = computeWordSpans(text);
    const words = spans.map((s) => s.word);

    setActiveIndex(-1);
    setPlaying(true);
    cancelTimers();
    cancelledRef.current = false;

    // Provisional timings from the calibrated estimate. Replaced in onStart if
    // the engine turns out to know its real duration.
    let timings = estimateWordTimings(words, estimatedDuration(text));
    let engineReportedDuration = false;
    let usingBoundaries = false;

    // Default time base: wall clock. Piper swaps in its AudioContext clock,
    // which cannot drift against the audio it scheduled.
    let clock: () => number = () => performance.now() / 1000;
    let startedAt = 0;

    // Words queued to light up but not yet rendered — see MIN_BOUNCE_MS.
    let lastFired = -1;
    const queue: number[] = [];
    let draining = false;

    const drain = () => {
      if (draining) return;
      draining = true;
      const step = () => {
        bounceRef.current = null;
        const next = queue.shift();
        if (next === undefined) {
          draining = false;
          return;
        }
        setActiveIndex(next);
        if (queue.length > 0) bounceRef.current = setTimeout(step, MIN_BOUNCE_MS);
        else draining = false;
      };
      step();
    };

    const enqueueThrough = (idx: number) => {
      if (idx <= lastFired) return;
      for (let i = lastFired + 1; i <= idx; i++) queue.push(i);
      lastFired = idx;
      drain();
    };

    const runTimer = () => {
      if (usingBoundaries) return; // real boundaries took over
      const elapsed = clock() - startedAt;
      for (let i = 0; i < timings.length; i++) {
        if (elapsed >= timings[i].start && i > lastFired) enqueueThrough(i);
        else if (elapsed < timings[i].start) break;
      }
      if (elapsed < (timings[timings.length - 1]?.end ?? 0) + 0.3) {
        rafRef.current = requestAnimationFrame(runTimer);
      }
    };

    try {
      await client.speak(text, lang, {
        onStart: (info) => {
          if (typeof info.durationSecs === "number" && info.durationSecs > 0) {
            timings = estimateWordTimings(words, info.durationSecs);
            engineReportedDuration = true;
          }
          if (info.clock) {
            clock = info.clock;
            startedAt = info.startedAt ?? info.clock();
          } else {
            startedAt = performance.now() / 1000;
          }
          if (!usingBoundaries) rafRef.current = requestAnimationFrame(runTimer);
        },
        onWord: (charIndex) => {
          usingBoundaries = true; // exact boundaries available → ditch the estimate
          cancelRaf();            // ...but let the bounce queue finish draining
          const idx = wordIndexAt(spans, charIndex);
          if (idx >= 0) enqueueThrough(idx);
        },
      });

      // Only the estimating engine has anything to learn: Piper already told us
      // the truth, so folding its timing in would just add noise.
      if (!cancelledRef.current && startedAt > 0 && !engineReportedDuration) {
        recordMeasurement(text, clock() - startedAt);
      }
    } finally {
      cancelTimers();
      setActiveIndex(-1);
      setPlaying(false);
      onDone?.();
    }
  }, [text, lang, onDone, cancelTimers, cancelRaf]);

  const stop = useCallback(() => {
    cancelledRef.current = true; // don't let an interrupted play skew calibration
    clientRef.current?.stop();
    cancelTimers();
    setActiveIndex(-1);
    setPlaying(false);
  }, [cancelTimers]);

  // Full teardown on unmount only.
  useEffect(() => {
    return () => {
      cancelTimers();
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, [cancelTimers]);

  return { play, stop, playing, activeIndex };
}

// ─── Component ───────────────────────────────────────────────────────────────

export type ChildHandle = {
  readAloud: () => void;
  stopReading: () => void;
  playing: boolean
}

interface TTSSentenceProps {
  text: string;
  lang?: string;
  autoPlay?: boolean;
  onDone?: () => void;
  /** Tailwind / CSS class for the outer wrapper */
  className?: string;
  ref?: Ref<ChildHandle>
}

export default function TTSSentence({
  text,
  lang = "en",
  onDone,
  className = "",
  ref
}: TTSSentenceProps) {
  const { play, stop, playing, activeIndex } = useTTS({ text, lang, onDone });
  const words = text.split(/\s+/).filter(Boolean);

  useImperativeHandle(ref, () => {
    return {
      readAloud () {
        play()
      },
      stopReading () {
        stop()
      },
      playing: playing
    }
  })

  return (
    <div className={className}>
      <p className="text-lg leading-relaxed text-slate-200 whitespace-pre-wrap flex flex-wrap gap-1">
        {words.map((word, i) => (
          <span key={i} className={`duration-75 ${i === activeIndex ? 'text-white font-bold scale-95 -mx-0.5' : ''}`}>
            {word}
          </span>
        ))}
      </p>
    </div>
  );
}
