"use client";
import { useEffect, useRef, useState } from "react";

export interface WaveformProps {
  /** Live audio to visualise. Pass null when nothing is being recorded. */
  stream?: MediaStream | null;
  /** Drives the idle vs listening appearance. */
  active?: boolean;
  bars?: number;
  /**
   * "center" mirrors each bar around a centre line, which is how an audio meter
   * is normally drawn and what makes it legible at small heights. "bottom"
   * anchors bars to the baseline, for use as a block element on a page.
   */
  align?: "center" | "bottom";
  /** Fixed colours, for use over video where theme tokens don't apply. */
  tone?: { active: string; idle: string };
  height?: string;
  className?: string;
}

/**
 * The Studio signature: the user's own voice, drawn.
 *
 * Three rules keep this from becoming decoration:
 *
 * 1. It reflects something real. When a stream is supplied the bars follow the
 *    actual microphone level via an AnalyserNode, so it tells you the mic is
 *    working and how loudly you are speaking — genuinely useful when you are
 *    about to be scored on delivery.
 * 2. It is still when nothing is happening. An idle waveform is a flat line,
 *    not a loop. Perpetual peripheral motion is a distraction and, at this
 *    size, a vestibular risk.
 * 3. It is `aria-hidden`. A screen-reader user gets the recording state from
 *    the button label and the status region, not from 48 animated bars.
 */
export default function Waveform({
  stream = null, active = false, bars = 44, align = "bottom",
  tone, height, className = "",
}: WaveformProps) {
  // The resting silhouette: a fixed, deterministic shape rather than a flat
  // line, so an idle waveform still reads as a waveform instead of a dashed
  // rule — and rather than Math.random(), which would twitch on every render.
  const restShape = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const envelope = Math.sin(Math.PI * t) ** 0.4;   // full across the width
      const detail = 0.62 + 0.38 * Math.sin(i * 1.7) * Math.cos(i * 0.55);
      return Math.max(0.24, Math.min(1, envelope * detail));
    });

  const [levels, setLevels] = useState<number[]>(() => restShape(bars));
  const rafRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Respect the OS setting: no continuous animation, just a steady bar.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Motion in this component only ever means "audio is happening right now".
    // Idle, and anything at all under prefers-reduced-motion, is the static
    // resting shape; `active` then changes only the colour.
    if (!active || reduced) {
      setLevels(restShape(bars));
      return;
    }

    // With a real stream, follow the microphone. Without one (the marketing
    // state, or before permission is granted), fall back to a gentle synthetic
    // shimmer so the control still reads as "live".
    if (stream && typeof window !== "undefined" && "AudioContext" in window) {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.max(1, Math.floor(data.length / bars));
        setLevels(
          Array.from({ length: bars }, (_, i) => {
            const v = data[Math.min(i * step, data.length - 1)] / 255;
            return Math.max(0.06, Math.min(1, v * 1.5));
          })
        );
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(rafRef.current);
        source.disconnect();
        ctx.close().catch(() => {});
        ctxRef.current = null;
      };
    }

    let t = 0;
    const tick = () => {
      t += 0.055;
      setLevels(
        Array.from({ length: bars }, (_, i) =>
          Math.max(
            0.08,
            Math.min(1, 0.45 + 0.4 * Math.sin(t + i * 0.42) * Math.sin(t * 0.6 + i * 0.13))
          )
        )
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stream, active, bars]);

  const anchor = align === "center" ? "items-center" : "items-end";

  return (
    <div
      aria-hidden
      className={`flex ${anchor} gap-[2px] ${className}`}
      style={{ height: height ?? "4rem" }}
    >
      {levels.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-full transition-[height,background-color] duration-100 ease-out
            ${tone ? "" : active ? "bg-accent" : "bg-line-strong"}`}
          style={{
            height: `${Math.round(v * 100)}%`,
            minHeight: align === "center" ? 3 : 4,
            background: tone ? (active ? tone.active : tone.idle) : undefined,
          }}
        />
      ))}
    </div>
  );
}
