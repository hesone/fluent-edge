"use client";
import type { FaceMetrics } from "@/lib/faceScoring";

/**
 * Live delivery metrics from the face landmarker.
 *
 * The whole widget is `aria-hidden` and paired with one polite summary line:
 * these numbers change many times a second, so exposing each to assistive tech
 * would produce a constant stream of announcements while the user is trying to
 * speak. The summary gives the same information in a form that can be read on
 * demand.
 */
export default function ConfidenceGauge({ m }: { m: FaceMetrics }) {
  const c = m.confidence;
  const band = c >= 70 ? "Strong" : c >= 45 ? "Steady" : "Low";
  const tone = c >= 70 ? "text-accent-text" : c >= 45 ? "text-warning" : "text-danger";
  const stroke = c >= 70 ? "rgb(var(--c-accent-text))"
    : c >= 45 ? "rgb(var(--c-warning))" : "rgb(var(--c-danger))";

  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (c / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="sr-only">
        {`Delivery confidence ${c} out of 100, ${band}. Eye contact ${m.eyeContact}, engagement ${m.engagement}, head stability ${m.headStability}, nervousness ${m.nervousness}.`}
      </p>

      <div aria-hidden className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgb(var(--c-surface-2))" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="52" fill="none" stroke={stroke} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${tone}`}>{c}</span>
          {/* The band word means the reading isn't carried by colour alone */}
          <span className={`text-2xs font-semibold uppercase tracking-wider ${tone}`}>{band}</span>
        </div>
      </div>
      <p aria-hidden className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
        Confidence
      </p>

      <div aria-hidden className="grid w-full grid-cols-2 gap-1.5 text-xs">
        <Metric label="Eye contact" v={m.eyeContact} />
        <Metric label="Engagement" v={m.engagement} />
        <Metric label="Stability" v={m.headStability} />
        <Metric label="Nervousness" v={m.nervousness} invert />
      </div>
    </div>
  );
}

function Metric({ label, v, invert }: { label: string; v: number; invert?: boolean }) {
  const good = invert ? v < 40 : v > 60;
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-1.5">
      <div className="flex justify-between gap-2">
        <span className="text-fg-muted">{label}</span>
        <span className={`font-semibold ${good ? "text-accent-text" : "text-warning"}`}>{v}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded bg-line">
        <div
          className={`h-full ${good ? "bg-accent" : "bg-warning"}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}
