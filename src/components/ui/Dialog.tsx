"use client";
import { useEffect, useId, useRef } from "react";
import { LuX } from "react-icons/lu";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional footer row, e.g. actions. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Modal dialog, built on the native <dialog> element.
 *
 * `showModal()` gives us — for free and correctly — a focus trap, Escape to
 * close, inertness of the rest of the page, focus restored to whatever opened
 * it, and a top-layer backdrop that no z-index can fight with. The previous
 * replay modal had none of these: focus stayed loose behind the overlay,
 * Escape did nothing, and dismissing was mouse-only.
 */
export default function Dialog({
  open, onClose, title, children, footer, className = "",
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape fires `cancel`; route it through the same close path as the
      // button so the parent's state stays in sync.
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClose={onClose}
      // Clicking the backdrop closes. The backdrop is the dialog element
      // itself, so a click whose target is the dialog (not its contents) is a
      // backdrop click.
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`m-auto w-[min(42rem,calc(100vw-2rem))] rounded-2xl border border-line
                  bg-surface p-0 text-fg shadow-lg backdrop:bg-black/60
                  open:animate-fade-in ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <h2 id={titleId} className="text-lg font-bold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="-me-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                     text-fg-muted transition-colors duration-fast hover:bg-surface-2 hover:text-fg"
        >
          <LuX aria-hidden className="h-5 w-5" />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
    </dialog>
  );
}
