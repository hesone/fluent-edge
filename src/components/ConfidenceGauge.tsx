"use client";
import type { FaceMetrics } from "@/lib/faceScoring";

/**
 * Live delivery readout, overlaid on the camera.
 *
 * Design notes, because the constraints here are unusual:
 *
 * - **One element, not several.** This was two floating chips of different
 *   widths with a gap between them, which read as debris rather than a designed
 *   overlay. It is now a single lozenge.
 *
 * - **One number, not five.** It previously showed confidence plus four
 *   labelled mini-meters at 9px. Nobody reads four numbers while speaking on
 *   camera. The lozenge shows the headline score; the weakest metric is
 *   surfaced instead as a single instruction the user can actually act on
 *   ("Look at the camera"). The full breakdown is still in the accessible
 *   summary, and belongs on the results screen where there is time to read it.
 *
 * - **Opaque, fixed colours.** It sits on live video, so nothing behind it can
 *   be predicted or contrast-checked. The scrim is opaque and the palette is
 *   deliberately theme-independent — the backdrop is the user's face, not the
 *   page. Values verified against a blown-out white frame, the worst case.
 *
 * - **`aria-hidden` plus one polite summary.** These update many times a
 *   second; exposing each change would talk over the user as they speak.
 */

const INK = "rgb(16 16 18 / 0.94)";
const DIM = "rgb(168 168 176)";
const LIME = "rgb(200 247 81)";
const AMBER = "rgb(255 197 61)";
const RED = "rgb(255 128 128)";

/** The single most useful thing to fix right now, or nothing if all is well. */
function nudgeFor(m: FaceMetrics): { icon: string; text: string } | null {
  const candidates = [
    { v: m.eyeContact, weight: m.eyeContact, icon: "👁", text: "Look at the camera" },
    { v: m.headStability, weight: m.headStability, icon: "🧍", text: "Try to sit steadier" },
    { v: m.engagement, weight: m.engagement, icon: "✨", text: "Bring a little more energy" },
    // Nervousness is inverted: high is bad.
    { v: 100 - m.nervousness, weight: 100 - m.nervousness, icon: "🌊", text: "Take a breath and slow down" },
  ];
  const worst = candidates.reduce((a, b) => (b.weight < a.weight ? b : a));
  return worst.weight < 45 ? { icon: worst.icon, text: worst.text } : null;
}

export default function ConfidenceGauge({ m }: { m: FaceMetrics }) {
  const c = Math.max(0, Math.min(100, m.confidence));
  const band = c >= 70 ? "Strong" : c >= 45 ? "Steady" : "Low";
  const tone = c >= 70 ? LIME : c >= 45 ? AMBER : RED;
  const nudge = nudgeFor(m);

  // Arc geometry: a 3/4 sweep reads as a gauge rather than a loading spinner.
  const r = 15;
  const circ = 2 * Math.PI * r;
  const sweep = 0.75;
  const dash = circ * sweep;

  return (
    <>
      <p className="sr-only">
        {`Delivery confidence ${c} out of 100, ${band}. Eye contact ${m.eyeContact}, engagement ${m.engagement}, head stability ${m.headStability}, nervousness ${m.nervousness}.`}
      </p>

      <div aria-hidden className="flex flex-col items-start gap-1.5">
        {/* The hairline matters: against a dark frame the scrim is nearly the
            same value as the video, so without it the lozenge loses its shape
            and the numbers read as text floating on the user's face. */}
        <div
          className="flex items-center gap-2.5 rounded-2xl py-1.5 pe-4 ps-1.5"
          style={{ background: INK, boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.14)" }}
        >
          <span className="relative grid h-9 w-9 place-items-center">
            <svg viewBox="0 0 40 40" className="h-9 w-9 -rotate-[135deg]">
              <circle
                cx="20" cy="20" r={r} fill="none" stroke="rgb(255 255 255 / 0.22)"
                strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
              />
              <circle
                cx="20" cy="20" r={r} fill="none" stroke={tone}
                strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${dash * (c / 100)} ${circ}`}
                style={{ transition: "stroke-dasharray 300ms ease-out, stroke 300ms" }}
              />
            </svg>
          </span>

          {/* Label above value: "82 Strong Delivery" put the category last,
              which reads backwards. Stacked, the lozenge stays compact and the
              number is unambiguous the first time you see it on your own face. */}
          <span className="flex flex-col gap-0.5 leading-none">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: DIM }}>
              Delivery
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold leading-none tabular-nums" style={{ color: tone }}>{c}</span>
              <span className="text-xs font-semibold leading-none" style={{ color: tone }}>{band}</span>
            </span>
          </span>
        </div>

        {nudge && (
          <p
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{
              background: INK,
              color: "rgb(237 237 234)",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.14)",
            }}
          >
            <span>{nudge.icon}</span>
            {nudge.text}
          </p>
        )}
      </div>
    </>
  );
}
