"use client";
export default function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-slate-300">
        Question {current + 1} of {total}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>
    </div>
  );
}