"use client";
import { useId } from "react";

interface Shared {
  label: string;
  hint?: string;
  error?: string;
  /** Hide the label visually but keep it for assistive tech. */
  labelHidden?: boolean;
  className?: string;
}

/**
 * Wraps a control with its label, hint and error and wires up the ids.
 *
 * The previous build put a bare <label> above each control with no `htmlFor`,
 * so nothing was actually associated: clicking the label did nothing and a
 * screen reader announced an unlabelled input. `useId` gives us stable ids
 * across server and client render.
 */
function Field({
  label, hint, error, labelHidden, className = "", children, id, describedBy,
}: Shared & {
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": true | undefined;
  }) => React.ReactNode;
  id: string;
  describedBy: string | undefined;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={labelHidden ? "sr-only" : "mb-2 block font-semibold"}
      >
        {label}
      </label>
      {hint && <p id={hintId} className="mb-2 text-sm text-fg-muted">{hint}</p>}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  "w-full rounded-xl border border-line-strong bg-surface px-4 text-fg " +
  "placeholder:text-fg-muted transition-colors duration-fast " +
  "hover:border-fg-muted aria-[invalid=true]:border-danger";

export function TextField({
  label, hint, error, labelHidden, className, ...rest
}: Shared & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean).join(" ") || undefined;
  return (
    <Field {...{ label, hint, error, labelHidden, className, id, describedBy }}>
      {(p) => <input {...p} {...rest} className={`${CONTROL} h-12`} />}
    </Field>
  );
}

export function TextArea({
  label, hint, error, labelHidden, className, rows = 6, ...rest
}: Shared & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean).join(" ") || undefined;
  return (
    <Field {...{ label, hint, error, labelHidden, className, id, describedBy }}>
      {(p) => (
        <textarea {...p} {...rest} rows={rows} className={`${CONTROL} py-3 leading-relaxed`} />
      )}
    </Field>
  );
}
