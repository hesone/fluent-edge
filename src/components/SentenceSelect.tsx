"use client";
import { useEffect, useId, useRef, useState } from "react";
import { LuChevronDown } from "react-icons/lu";

export interface SentenceOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
  description?: string;
}

/**
 * A tappable word inside the set-up sentence ("I'm preparing for a [job
 * interview] in [English]…"). Opens a small listbox under the word.
 *
 * Keyboard: Enter / Space / ArrowDown open it, arrows move, Enter picks,
 * Escape closes and returns focus to the word. The trigger's accessible name
 * includes what it controls ("Practice type: job interview").
 */
export default function SentenceSelect<T extends string>({
  label, value, options, onChange,
}: {
  /** What this word controls, for assistive tech and the menu heading. */
  label: string;
  value: T;
  options: SentenceOption<T>[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    listRef.current?.focus();
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function openMenu() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function pick(i: number) {
    onChange(options[i].value);
    setOpen(false);
    btnRef.current?.focus();
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + options.length) % options.length); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
    else if (e.key === "Escape" || e.key === "Tab") { setOpen(false); if (e.key === "Escape") btnRef.current?.focus(); }
  }

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${current.label}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); openMenu(); }
        }}
        className="inline-flex items-center gap-1 rounded-t-lg border-b-2 border-accent-text bg-accent-soft px-2 py-0.5
                   font-semibold leading-snug text-fg transition-colors duration-fast hover:bg-accent/40"
      >
        {current.icon && <span aria-hidden>{current.icon}</span>}
        {current.label}
        <LuChevronDown aria-hidden className={`h-4 w-4 text-fg-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className="absolute start-0 top-full z-30 mt-1 max-h-[28rem] w-max min-w-[12rem] max-w-[min(22rem,calc(100vw-2rem))]
                     overflow-auto rounded-xl border border-line bg-surface p-1 text-base font-normal shadow-lg outline-none"
        >
          <div role="presentation" className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-fg-muted">
            {label}
          </div>
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <div
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 leading-snug ${
                  i === active ? "bg-surface-2" : ""
                }`}
              >
                {o.icon && <span aria-hidden className="mt-0.5">{o.icon}</span>}
                <span className="min-w-0 flex-1">
                  <span className={`block ${selected ? "font-semibold text-accent-text" : ""}`}>{o.label}</span>
                  {o.description && <span className="block text-sm text-fg-muted">{o.description}</span>}
                </span>
                {selected && <span aria-hidden className="text-accent-text">✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}

/**
 * A free-text word in the set-up sentence ("…about [ordering at a bakery]").
 * Shows the text inline (it wraps like the rest of the sentence) and edits it
 * in a small popover, so a long situation never overflows on a phone.
 */
export function SentenceText({
  label, value, placeholder, onChange,
}: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const close = () => { setOpen(false); btnRef.current?.focus(); };

  return (
    <span ref={wrapRef} className="relative inline">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-label={`${label}: ${value || "not set"}`}
        onClick={() => setOpen(!open)}
        className={`rounded-t-lg border-b-2 border-accent-text bg-accent-soft px-2 py-0.5 text-start font-semibold leading-snug
                    transition-colors duration-fast hover:bg-accent/40 ${value ? "text-fg" : "font-normal italic text-fg-muted"}`}
      >
        ✏️ {value || placeholder}
      </button>
      {open && (
        <span className="absolute start-0 top-full z-30 mt-1 block w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-3 text-base font-normal shadow-lg">
          <label htmlFor={inputId} className="mb-2 block text-2xs font-semibold uppercase tracking-wider text-fg-muted">{label}</label>
          <textarea
            id={inputId}
            autoFocus
            rows={3}
            value={value}
            placeholder="e.g. ordering at a bakery in Berlin, meeting new neighbours…"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); close(); }
            }}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-fg-muted"
          />
          <span className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-fg-muted">The more specific, the better the questions.</span>
            <button type="button" onClick={close} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg">Done</button>
          </span>
        </span>
      )}
    </span>
  );
}
