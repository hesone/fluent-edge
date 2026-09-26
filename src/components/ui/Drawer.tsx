"use client";
import { useEffect, useId, useRef } from "react";
import { LuX } from "react-icons/lu";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Small line above the title, e.g. the responsibility. */
  eyebrow?: string;
  children: React.ReactNode;
}

/**
 * Side panel that slides in from the end edge (right in LTR, left in RTL).
 *
 * Same foundation as Dialog — the native <dialog> with showModal() — so it
 * gets the focus trap, Escape, inert background and focus return for free.
 * Used for details that shouldn't push the page down (story evaluations).
 */
export default function Drawer({ open, onClose, title, eyebrow, children }: DrawerProps) {
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
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="fixed inset-y-0 end-0 start-auto m-0 h-full max-h-none w-[min(38rem,100vw)] max-w-none
                 border-s border-line bg-surface p-0 text-fg shadow-lg backdrop:bg-black/50 open:animate-fade-in"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow truncate">{eyebrow}</p>}
            <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-me-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                       text-fg-muted transition-colors duration-fast hover:bg-surface-2 hover:text-fg"
          >
            <LuX aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </dialog>
  );
}
