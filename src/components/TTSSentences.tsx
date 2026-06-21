"use client";

import { useEffect, useRef, useCallback, useState, useImperativeHandle, Ref } from "react";
import { TTSClient } from "@/lib/ttsClient";

// ─── Word timing estimation ─────────────────────────────────────────────────

interface WordTiming {
  start: number; // seconds, relative to playback start
  end: number;
}

function estimateWordTimings(words: string[], durationSecs: number): WordTiming[] {
  if (!words.length || durationSecs <= 0) return [];
 
  function weightOf(word: string): number {
    const letters = word.replace(/[^\p{L}\p{N}]/gu, "").length;
    const base = Math.max(letters, 1);
    if (/[.!?]["'\u201d\u2019)\]]*$/.test(word)) return base + 4; // sentence end — longer pause
    if (/[,;:\u2014\u2013-]["'\u201d\u2019)\]]*$/.test(word)) return base + 2; // clause break — shorter pause
    return base;
  }
 
  const weights = words.map(weightOf);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
 
  // Fixed per-word gap, independent of total duration or word count.
  // Also self-limits for very short clips so a handful of words don't
  // get swallowed entirely by gap time.
  const GAP = Math.min(0.03, durationSecs / (words.length * 4));
  const totalGapTime = GAP * (words.length - 1);
 
  // Never let "real speaking time" drop below half the total duration,
  // however many words or however the gap math works out.
  const textTime = Math.max(durationSecs - totalGapTime, durationSecs * 0.5);
 
  let cursor = 0;
  return weights.map((w) => {
    const wordDur = (w / totalWeight) * textTime;
    const start = cursor;
    const end = start + wordDur;
    cursor = end + GAP;
    return { start, end };
  });
}
 
// ─── Hook ────────────────────────────────────────────────────────────────────
 
interface UseTTSOptions {
  text: string;
  lang?: string;
  onDone?: () => void;
}
 
function useTTS({ text, lang = "en", onDone }: UseTTSOptions) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [doneIndex, setDoneIndex] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
 
  // One TTSClient instance per component, created lazily, torn down on unmount.
  const clientRef = useRef<TTSClient | null>(null);
  const rafRef = useRef<number | null>(null);
  const drainTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 
  function getClient(): TTSClient {
    if (!clientRef.current) clientRef.current = new TTSClient();
    return clientRef.current;
  }
 
  const cancelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (drainTimeoutRef.current !== null) {
      clearTimeout(drainTimeoutRef.current);
      drainTimeoutRef.current = null;
    }
  }, []);
 
  const play = useCallback(async () => {
    if (!text) return;
    const client = getClient();
 
    setActiveIndex(-1);
    setDoneIndex(-1);
    setPlaying(true);
    cancelLoop();
 
    const words = text.split(/\s+/).filter(Boolean);
 
    try {
      await client.speak(text, lang, (durationSecs, startedAt) => {
        const ctx = client.getAudioContext();
        const timings = estimateWordTimings(words, durationSecs);
        let lastFired = -1;
 
        // Words queued to bounce but not yet rendered. When a slow/janky
        // frame causes elapsed time to jump past more than one word's
        // start, every one of those words goes in here instead of only
        // the last — otherwise React's state batching would only ever
        // show the final word as active and the rest would silently
        // skip straight from "upcoming" to "done".
        let bounceQueue: number[] = [];
        let draining = false;
 
        // Drains the queue one word at a time on a short timer, so each
        // skipped word still gets its own brief active render and bounce
        // animation instead of being collapsed into the next one.
        const MIN_BOUNCE_MS = 60;
        function drainQueue() {
          if (draining) return;
          draining = true;
 
          const step = () => {
            drainTimeoutRef.current = null;
            const next = bounceQueue.shift();
            if (next === undefined) {
              draining = false;
              return;
            }
            setDoneIndex(next - 1);
            setActiveIndex(next);
            if (bounceQueue.length > 0) {
              drainTimeoutRef.current = setTimeout(step, MIN_BOUNCE_MS);
            } else {
              draining = false;
            }
          };
          step();
        }
 
        const loop = () => {
          const elapsed = ctx.currentTime - startedAt;
 
          for (let i = 0; i < timings.length; i++) {
            if (elapsed >= timings[i].start && i > lastFired) {
              lastFired = i;
              bounceQueue.push(i);
            }
          }
          if (bounceQueue.length > 0) drainQueue();
 
          if (elapsed < (timings[timings.length - 1]?.end ?? 0) + 0.3) {
            rafRef.current = requestAnimationFrame(loop);
          }
        };
        rafRef.current = requestAnimationFrame(loop);
      });
    } finally {
      cancelLoop();
      setActiveIndex(-1);
      setDoneIndex(Infinity); // all words marked done
      setPlaying(false);
      onDone?.();
    }
  }, [text, lang, onDone, cancelLoop]);
 
  const stop = useCallback(() => {
    clientRef.current?.stop();
    cancelLoop();
    setActiveIndex(-1);
    setDoneIndex(-1);
    setPlaying(false);
  }, [cancelLoop]);
 
  // Full teardown on unmount only.
  useEffect(() => {
    return () => {
      cancelLoop();
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, [cancelLoop]);
 
  return { play, stop, playing, activeIndex, doneIndex };
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