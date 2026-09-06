"use client";

export type Band = "strong" | "fair" | "weak";

export function bandFor(v: number): Band {
  return v >= 80 ? "strong" : v >= 50 ? "fair" : "weak";
}

const BAND = {
  strong: { cls: "border-accent-text/30 bg-accent-soft text-accent-text", word: "Strong" },
  fair: { cls: "border-warning/30 bg-warning-soft text-warning", word: "Fair" },
  weak: { cls: "border-danger/30 bg-danger-soft text-danger", word: "Needs work" },
} as const;

export interface ScoreTileProps {
  label: string;
  value: number;
  /** Override the band words, e.g. for a translated UI. */
  words?: Partial<Record<Band, string>>;
  emphasis?: boolean;
  className?: string;
}

/**
 * One score.
 *
 * The band is stated in words as well as colour — the old tiles used
 * green/amber/red alone, which is exactly the failure mode WCAG 1.4.1 is
 * about. The number is read together with its label and band via a single
 * accessible string so it is not announced as a bare digit.
 */
export default function ScoreTile({
  label, value, words, emphasis, className = "",
}: ScoreTileProps) {
  const band = bandFor(value);
  const { cls } = BAND[band];
  const word = words?.[band] ?? BAND[band].word;

  return (
    <div className={`rounded-xl border p-3 text-center ${cls} ${className}`}>
      <p className="sr-only">{`${label}: ${value} out of 100, ${word}`}</p>
      <div aria-hidden>
        <div className={`font-bold ${emphasis ? "text-3xl" : "text-2xl"}`}>{value}</div>
        <div className="text-2xs font-semibold uppercase tracking-wider">{word}</div>
        <div className="mt-1 text-xs text-fg-muted">{label}</div>
      </div>
    </div>
  );
}
