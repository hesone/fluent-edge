"use client";
import { useEffect } from "react";
import confetti from "canvas-confetti";

export function fireCardConfetti(origin?: { x: number; y: number }) {
  confetti({
    particleCount: 80, spread: 70, origin: origin ?? { y: 0.6 },
    colors: ["#6366f1", "#22c55e", "#eab308", "#ec4899"],
  });
}

export function FullPageConfetti() {
  useEffect(() => {
    const end = Date.now() + 4000;
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 80, origin: { x: 0 }, colors: ["#6366f1", "#22c55e"] });
      confetti({ particleCount: 6, angle: 120, spread: 80, origin: { x: 1 }, colors: ["#eab308", "#ec4899"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);
  return null;
}