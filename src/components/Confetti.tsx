"use client";
import { useEffect } from "react";
import confetti from "canvas-confetti";

/**
 * Celebration effects.
 *
 * Both entry points check `prefers-reduced-motion` and do nothing when it is
 * set — a full-screen particle storm is exactly the kind of motion that
 * triggers vestibular symptoms, and it previously ran regardless of the
 * setting. Colours come from the theme tokens rather than a hardcoded list.
 */
function motionOK() {
  if (typeof window === "undefined") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function tokenColors(): string[] {
  const cs = getComputedStyle(document.documentElement);
  const read = (name: string) => {
    const v = cs.getPropertyValue(name).trim();
    return v ? `rgb(${v.replace(/\s+/g, " ")})` : "#8b5cf6";
  };
  return [read("--c-accent"), read("--c-accent"), read("--c-warning")];
}

export function fireCardConfetti(origin?: { x: number; y: number }) {
  if (!motionOK()) return;
  confetti({
    particleCount: 80,
    spread: 70,
    origin: origin ?? { y: 0.6 },
    colors: tokenColors(),
    disableForReducedMotion: true,
  });
}

export function FullPageConfetti() {
  useEffect(() => {
    if (!motionOK()) return;
    const colors = tokenColors();
    const end = Date.now() + 4000;
    let raf = 0;
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 80, origin: { x: 0 }, colors, disableForReducedMotion: true });
      confetti({ particleCount: 6, angle: 120, spread: 80, origin: { x: 1 }, colors, disableForReducedMotion: true });
      if (Date.now() < end) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, []);
  return null;
}
