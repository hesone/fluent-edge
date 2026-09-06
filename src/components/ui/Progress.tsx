"use client";
import { useId } from "react";

export interface ProgressProps {
  current: number;   // zero-based
  total: number;
  /** Visible label; also used as the progress bar's accessible text. */
  label?: string;
  className?: string;
}

/**
 * Session progress.
 *
 * Adds the semantics the old Stepper lacked: a `progressbar` role with
 * `aria-valuetext`, so it is announced as "Question 3 of 6" rather than an
 * unlabelled 50%.
 */
export default function Progress({ current, total, label, className = "" }: ProgressProps) {
  const labelId = useId();
  const done = Math.min(current + 1, total);
  const pct = total > 0 ? (done / total) * 100 : 0;
  const text = label ?? `Question ${done} of ${total}`;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-baseline justify-between gap-4">
        <span id={labelId} className="text-sm font-semibold">{text}</span>
        <span className="text-sm text-fg-muted">{Math.round(pct)}%</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={text}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-slow ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
