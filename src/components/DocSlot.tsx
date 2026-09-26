"use client";
import { useId, useRef, useState } from "react";
import { LuClipboardPaste, LuFileText, LuPencil, LuUpload, LuX } from "react-icons/lu";
import Button from "@/components/ui/Button";

/**
 * One document on the set-up screen (résumé or job description).
 *
 * Empty   → a compact drop zone with "Upload PDF" and "Paste text".
 * Filled  → shrinks to a one-line summary with Edit / Replace / Remove, so
 *           the whole set-up fits on one screen once your documents are in.
 * Editing → a text box, opened by "Paste text" or "Edit".
 */
export default function DocSlot({
  icon, title, hint, text, summary, minLength = 1, placeholder, onText,
}: {
  icon: string;
  title: string;
  hint: string;
  text: string;
  /** One line shown when filled, e.g. "hesam_cv.pdf · 7 yrs". */
  summary?: string;
  /** Below this length the text counts as "too short" rather than filled. */
  minLength?: number;
  placeholder: string;
  onText: (text: string) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const filled = text.trim().length >= minLength;

  async function readFile(file: File) {
    setFileName(file.name);
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (data.text) { onText(data.text); setEditing(false); }
      else setError("No text found in that PDF — if it's a scan, paste the text instead.");
    } catch {
      setError("Reading that file failed. Try again, or paste the text.");
    } finally {
      setBusy(false);
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      id={id}
      type="file"
      accept="application/pdf"
      className="sr-only"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) readFile(f);
        e.target.value = "";
      }}
    />
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) readFile(f);
      }}
      className={`flex min-w-0 flex-col gap-2 rounded-xl border-2 p-3 transition-colors duration-fast ${
        dragging ? "border-accent bg-accent-soft"
          : filled && !editing ? "border-accent-text/40 bg-accent-soft"
          : "border-dashed border-line-strong bg-surface-2"
      }`}
    >
      {fileInput}
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-lg leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">
            {title}
            {filled && !editing && <span className="ms-1 text-accent-text">✓<span className="sr-only"> added</span></span>}
          </p>
          <p role="status" aria-live="polite" className={`mt-0.5 truncate text-sm ${error ? "font-medium text-danger" : "text-fg-muted"}`}>
            {error || (busy ? `Reading ${fileName}…` : filled && !editing ? (summary || fileName || `${text.trim().length.toLocaleString()} characters`) : hint)}
          </p>
        </div>
        {filled && !editing && (
          <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${title}`} onClick={() => { onText(""); setFileName(""); }}>
            <LuX aria-hidden className="h-4 w-4" />
          </Button>
        )}
      </div>

      {editing && (
        <textarea
          aria-label={title}
          autoFocus
          rows={6}
          value={text}
          placeholder={placeholder}
          onChange={(e) => onText(e.target.value)}
          className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm leading-relaxed text-fg placeholder:text-fg-muted"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <Button size="sm" onClick={() => setEditing(false)}>Done</Button>
        ) : (
          <>
            <Button size="sm" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
              {!busy && (filled ? <LuFileText aria-hidden className="h-4 w-4" /> : <LuUpload aria-hidden className="h-4 w-4" />)}
              {filled ? "Replace PDF" : "Upload PDF"}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
              {filled ? <LuPencil aria-hidden className="h-4 w-4" /> : <LuClipboardPaste aria-hidden className="h-4 w-4" />}
              {filled ? "Edit" : "Paste text"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
