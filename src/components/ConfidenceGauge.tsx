"use client";
import type { FaceMetrics } from "@/lib/faceScoring";

export default function ConfidenceGauge({ m }: { m: FaceMetrics }) {
  const c = m.confidence;
  const color = c >= 70 ? "#22c55e" : c >= 45 ? "#eab308" : "#ef4444";
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (c / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-32 w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-300"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{c}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400">confidence</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-1.5 text-xs">
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
    <div className="rounded-lg bg-slate-800/60 px-2 py-1">
      <div className="flex justify-between text-slate-300">
        <span>{label}</span>
        <span className={good ? "text-green-400" : "text-amber-400"}>{v}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded bg-slate-700">
        <div className={`h-full ${good ? "bg-green-400" : "bg-amber-400"}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}