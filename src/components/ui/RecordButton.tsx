"use client";
import { useId } from "react";
import { LuCheck, LuMic, LuSquare } from "react-icons/lu";

export interface RecordButtonProps {
  recording: boolean;
  disabled?: boolean;
  /** Words matched so far in this pass. */
  matched: number;
  total: number;
  /** Fraction (0–1) of words that must match to clear the pass. */
  threshold: number;
  onClick: () => void;
  className?: string;
}

/**
 * The record control, with the pass progress built into it.
 *
 * The design turns on one decision: **progress is measured against the words
 * actually needed, not against the total.**
 *
 * The first version filled toward 100% while the goal was 92%, so it needed a
 * marker on the rail *and* the words "need 92%" just to explain where the
 * finish line was — a tick and a percentage to explain a bar. Scaling to
 * `ceil(total × threshold)` instead means the ring is full at exactly the
 * moment the pass clears. The marker and the percentage both become
 * unnecessary, and "17 / 18" is self-explanatory.
 *
 * The ring wraps the icon rather than running as a rail under the label, so the
 * text always sits on one solid colour and its contrast is provable. The ring
 * is drawn in the button's own foreground — 15:1 on the lime, 7:1 on the red.
 */
export default function RecordButton({
  recording, disabled, matched, total, threshold, onClick, className = "",
}: RecordButtonProps) {
  const descId = useId();
  const needed = Math.max(1, Math.ceil(total * threshold));
  const done = Math.min(matched, needed);
  const pct = total > 0 ? done / needed : 0;
  const complete = total > 0 && matched >= needed;
  const label = recording ? "Stop recording" : "Start recording";

  const r = 13;
  const circ = 2 * Math.PI * r;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        // The name stays the action; the count is a description, so it isn't
        // re-announced on every matched word.
        aria-label={label}
        aria-describedby={total > 0 ? descId : undefined}
        className={`flex h-14 w-full items-center gap-3 rounded-full border-2 ps-2 pe-6
          font-semibold transition-[background-color,color,transform] duration-fast
          disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2
          disabled:text-fg-muted active:enabled:translate-y-px
          ${recording
            ? "border-danger bg-danger text-danger-fg"
            : "border-accent-edge bg-accent text-accent-fg"}`}
      >
        <span className="relative grid h-10 w-10 shrink-0 place-items-center">
          {total > 0 && (
            <svg viewBox="0 0 36 36" className="absolute inset-0 h-10 w-10 -rotate-90">
              <circle cx="18" cy="18" r={r} fill="none" strokeWidth="2.5"
                      stroke="currentColor" opacity="0.28" />
              <circle
                cx="18" cy="18" r={r} fill="none" strokeWidth="2.5" strokeLinecap="round"
                stroke="currentColor"
                strokeDasharray={`${circ * pct} ${circ}`}
                style={{ transition: "stroke-dasharray 300ms ease-out" }}
              />
            </svg>
          )}
          {complete
            ? <LuCheck aria-hidden className="h-5 w-5" />
            : recording
              ? <LuSquare aria-hidden className="h-3.5 w-3.5 fill-current" />
              : <LuMic aria-hidden className="h-[18px] w-[18px]" />}
        </span>

        <span aria-hidden>{label}</span>

        {total > 0 && (
          <span aria-hidden className="ms-auto text-sm font-bold tabular-nums opacity-90">
            {done} / {needed}
          </span>
        )}
      </button>

      <span id={descId} className="sr-only">
        {complete
          ? `Enough words matched. ${matched} of ${total} recognised.`
          : `${done} of ${needed} words needed for this pass have matched.`}
      </span>
    </div>
  );
}
