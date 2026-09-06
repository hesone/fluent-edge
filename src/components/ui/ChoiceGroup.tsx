"use client";
import { useId, useRef } from "react";

export interface Choice<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Decorative only — it is hidden from assistive tech, the label carries the meaning. */
  icon?: React.ReactNode;
}

export interface ChoiceGroupProps<T extends string> {
  legend: string;
  /** Extra guidance, associated with the group via aria-describedby. */
  hint?: string;
  value: T;
  onChange: (value: T) => void;
  options: Choice<T>[];
  /** card = icon + label + description; tile = icon over label; compact = label only. */
  variant?: "card" | "tile" | "compact";
  columns?: 2 | 3 | 5 | 6;
  className?: string;
}

const COLS: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-3",
  5: "grid-cols-3 sm:grid-cols-5",
  6: "grid-cols-3 sm:grid-cols-6",
};

/**
 * A single-select group of options.
 *
 * The previous build rendered these as loose <button>s: a keyboard user had to
 * tab through all six CEFR levels to get past them, nothing announced that the
 * options were related or which was chosen, and selection was signalled by
 * colour alone. This is a real radio group:
 *
 * - one tab stop for the whole group (roving tabindex), arrows move within it
 * - `role="radio"` + `aria-checked`, so it is announced as "Junior, radio
 *   button, 1 of 3"
 * - arrow keys respect RTL, so they follow the visual order in Farsi
 * - the selected option is marked with a check and a heavier border as well as
 *   a colour change
 */
export default function ChoiceGroup<T extends string>({
  legend, hint, value, onChange, options, variant = "card", columns = 2, className = "",
}: ChoiceGroupProps<T>) {
  const hintId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  function move(from: number, delta: number) {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    // In RTL the left arrow moves forward visually, so flip the horizontal keys.
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";

    switch (e.key) {
      case forward:
      case "ArrowDown":
        e.preventDefault(); move(index, 1); break;
      case backward:
      case "ArrowUp":
        e.preventDefault(); move(index, -1); break;
      case "Home":
        e.preventDefault(); onChange(options[0].value); refs.current[0]?.focus(); break;
      case "End":
        e.preventDefault();
        onChange(options[options.length - 1].value);
        refs.current[options.length - 1]?.focus();
        break;
      case " ":
        e.preventDefault(); onChange(options[index].value); break;
    }
  }

  return (
    <fieldset className={className}>
      <legend className="mb-2 block font-semibold">{legend}</legend>
      {hint && (
        <p id={hintId} className="mb-3 text-sm text-fg-muted">{hint}</p>
      )}
      <div
        role="radiogroup"
        aria-describedby={hint ? hintId : undefined}
        className={`grid gap-2.5 ${COLS[columns]}`}
      >
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={i === selectedIndex ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={[
                "relative rounded-xl border-2 text-start transition-colors duration-fast",
                variant === "compact" ? "px-3 py-2.5 text-center" : "p-4",
                variant === "tile" ? "flex flex-col items-center gap-1 text-center" : "",
                on
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-line-strong hover:bg-surface-2",
              ].join(" ")}
            >
              {variant === "card" && (
                <span className="mb-2 flex items-start justify-between gap-3">
                  {o.icon && <span aria-hidden className="text-2xl leading-none">{o.icon}</span>}
                  <Check on={on} />
                </span>
              )}
              {variant === "tile" && o.icon && (
                <span aria-hidden className="text-2xl leading-none">{o.icon}</span>
              )}

              <span className={`block font-semibold ${on ? "text-accent-text" : ""} ${
                variant === "tile" ? "text-xs" : ""
              }`}>
                {o.label}
              </span>

              {o.description && (
                <span className="mt-0.5 block text-sm text-fg-muted">{o.description}</span>
              )}

              {/* Tile and compact are too small for the inline check, so the
                  selected state gets a corner marker instead — still a shape,
                  not just a colour. */}
              {variant !== "card" && on && (
                <span
                  aria-hidden
                  className="absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center
                             rounded-full bg-accent text-[9px] font-bold text-accent-fg"
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`ms-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold
        ${on ? "border-accent bg-accent text-accent-fg" : "border-line-strong"}`}
    >
      {on ? "✓" : ""}
    </span>
  );
}
