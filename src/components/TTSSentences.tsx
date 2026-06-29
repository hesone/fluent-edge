"use client";

import { useEffect, useRef, useCallback, useState, useImperativeHandle, Ref } from "react";
import { TTSClient } from "@/lib/ttsClient";

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

// Find the index of the word that contains (or most recently started before)
// the given character offset.
function wordIndexAt(spans: WordSpan[], charIndex: number): number {
  let idx = -1;
  for (let i = 0; i < spans.length; i++) {
    if (charIndex >= spans[i].start) idx = i;
    else break;
  }
  return idx;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseTTSOptions {
  text: string;
  lang?: string;
  onDone?: () => void;
}

// Approx characters spoken per second at rate=1 — the starting guess before
// the engine's real rate has been measured. Only used for voices that emit no
// boundary events.
const CHARS_PER_SEC = 13;

// Self-calibration. The Web Speech API won't tell us an utterance's duration up
// front, but we can time how long each one actually takes and learn from it:
//   • `measuredCharsPerSec` — a running estimate of this engine's speaking rate,
//     so the very first highlight of any new text is close and gets better.
//   • `durationCache` — the exact measured duration per text, so replaying the
//     same answer (common in Study mode) highlights in near-perfect sync.
// Module-level so the calibration persists across component instances/questions.
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

// Estimate a [start,end] time (seconds, relative to playback start) for each
// word, distributing an estimated total duration by word length with a little
// extra weight on punctuation pauses.
function estimateWordTimings(words: string[], durationSecs: number): { start: number; end: number }[] {
  if (!words.length || durationSecs <= 0) return [];
  const weightOf = (w: string) => {
    const base = Math.max(w.replace(/[^\p{L}\p{N}]/gu, "").length, 1);
    if (/[.!?]["'”’)\]]*$/.test(w)) return base + 4;
    if (/[,;:—–-]["'”’)\]]*$/.test(w)) return base + 2;
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

function useTTS({ text, lang = "en", onDone }: UseTTSOptions) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);

  // One TTSClient instance per component, created lazily, torn down on unmount.
  const clientRef = useRef<TTSClient | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  function getClient(): TTSClient {
    if (!clientRef.current) clientRef.current = new TTSClient();
    return clientRef.current;
  }

  const cancelTimer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const play = useCallback(async () => {
    if (!text || !TTSClient.isSupported()) return;
    const client = getClient();
    const spans = computeWordSpans(text);
    const words = spans.map((s) => s.word);
    const timings = estimateWordTimings(words, estimatedDuration(text));

    setActiveIndex(-1);
    setPlaying(true);
    cancelTimer();
    cancelledRef.current = false;

    // Highlighting is driven two ways, with boundary events winning when a
    // voice provides them:
    //   • Estimated timer — always runs, so karaoke works even on voices that
    //     emit no boundary events (e.g. Chrome's network "Google" voices).
    //   • Real boundary events — when they arrive, they're exact, so we drop
    //     the estimate and follow them instead.
    let usingBoundaries = false;
    let startedAt = 0;

    const runTimer = () => {
      if (usingBoundaries) return;
      const elapsed = (performance.now() - startedAt) / 1000;
      let idx = -1;
      for (let i = 0; i < timings.length; i++) {
        if (elapsed >= timings[i].start) idx = i;
        else break;
      }
      if (idx >= 0) setActiveIndex(idx);
      if (elapsed < (timings[timings.length - 1]?.end ?? 0)) {
        rafRef.current = requestAnimationFrame(runTimer);
      }
    };

    try {
      await client.speak(text, lang, {
        onStart: () => {
          startedAt = performance.now();
          if (!usingBoundaries) rafRef.current = requestAnimationFrame(runTimer);
        },
        onWord: (charIndex) => {
          usingBoundaries = true; // exact boundaries available → ditch the estimate
          cancelTimer();
          const idx = wordIndexAt(spans, charIndex);
          if (idx >= 0) setActiveIndex(idx);
        },
      });

      // Speech finished on its own — learn this engine's real timing so the
      // next play (and replays of this text) sync better.
      if (!cancelledRef.current && startedAt > 0) {
        recordMeasurement(text, (performance.now() - startedAt) / 1000);
      }
    } finally {
      cancelTimer();
      setActiveIndex(-1);
      setPlaying(false);
      onDone?.();
    }
  }, [text, lang, onDone, cancelTimer]);

  const stop = useCallback(() => {
    cancelledRef.current = true; // don't let an interrupted play skew calibration
    clientRef.current?.stop();
    cancelTimer();
    setActiveIndex(-1);
    setPlaying(false);
  }, [cancelTimer]);

  // Full teardown on unmount only.
  useEffect(() => {
    return () => {
      cancelTimer();
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, [cancelTimer]);

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
