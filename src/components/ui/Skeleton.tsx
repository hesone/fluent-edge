"use client";

/**
 * Loading placeholder.
 *
 * The visual bars are `aria-hidden` — a screen reader should never be read a
 * row of decorative rectangles. The wrapper announces the wait once instead,
 * politely, and the caller replaces the whole block with real content when it
 * arrives.
 */
export function SkeletonText({
  lines = 4,
  label = "Loading…",
  className = "",
}: { lines?: number; label?: string; className?: string }) {
  // Deterministic widths: Math.random() here would change on every render and
  // make the block twitch while it loads.
  const widths = [96, 88, 92, 74, 84, 63, 90, 55];
  return (
    <div role="status" aria-live="polite" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className="space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="h-4 overflow-hidden rounded bg-surface-2"
            style={{ width: `${widths[i % widths.length]}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-xl bg-surface-2 ${className}`} />;
}
