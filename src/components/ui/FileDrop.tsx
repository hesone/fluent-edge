"use client";
import { useId, useRef, useState } from "react";
import { LuFileText, LuUpload } from "react-icons/lu";

export interface FileDropProps {
  label: string;
  hint?: string;
  accept?: string;
  /** Shown once a file has been read successfully. */
  status?: string;
  error?: string;
  busy?: boolean;
  busyLabel?: string;
  fileName?: string;
  onFile: (file: File) => void;
  className?: string;
}

/**
 * File picker with a drop zone.
 *
 * The old version hid a file input inside a <label>, which works with a mouse
 * but leaves keyboard users with an invisible target and no focus ring. Here
 * the input itself is the focusable element — visually hidden but not
 * `display:none` — and the drop zone reflects its focus with `peer-focus`.
 * Parse progress and results go through a live region rather than appearing
 * silently.
 */
export default function FileDrop({
  label, hint, accept = "application/pdf", status, error, busy, busyLabel = "Reading file…",
  fileName, onFile, className = "",
}: FileDropProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const describedBy = [hint && `${id}-hint`, `${id}-status`].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block font-semibold">{label}</label>
      {hint && <p id={`${id}-hint`} className="mb-2 text-sm text-fg-muted">{hint}</p>}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className="relative"
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          aria-describedby={describedBy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
          // Visually hidden but still focusable and still the real control.
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div
          className={`pointer-events-none flex flex-col items-center justify-center gap-2 rounded-2xl
            border-2 border-dashed px-6 py-8 text-center transition-colors duration-fast
            peer-hover:border-accent peer-focus-visible:border-accent
            peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2
            peer-focus-visible:ring-offset-canvas
            ${dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2"}`}
        >
          {fileName ? (
            <LuFileText aria-hidden className="h-7 w-7 text-accent-text" />
          ) : (
            <LuUpload aria-hidden className="h-7 w-7 text-fg-muted" />
          )}
          <span className="text-sm font-medium">
            {busy ? busyLabel : fileName || "Choose a file or drop it here"}
          </span>
          {!busy && !fileName && (
            <span className="text-xs text-fg-muted">PDF, up to a few pages</span>
          )}
        </div>
      </div>

      {/* One live region for the whole control, so progress and result are
          announced without the caller wiring anything up. */}
      <p
        id={`${id}-status`}
        role="status"
        aria-live="polite"
        className={`mt-2 text-sm ${error ? "font-medium text-danger" : "text-accent-text"}`}
      >
        {error || (busy ? busyLabel : status) || ""}
      </p>
    </div>
  );
}
