"use client";
import { normalizeWord, type WordState } from "@/lib/pronunciation";

export default function WordSpans({
  words, states, hidden, karaokeMode,
}: {
  words: string[];
  states: WordState[];
  hidden: boolean;          // fully hidden (all green achieved)
  karaokeMode: boolean;     // memory phase: only reveal correct words
}) {
  if (hidden && !karaokeMode) return null;

  return (
    <p className="flex flex-wrap gap-x-2 gap-y-1 text-2xl leading-relaxed">
      {words.map((w, i) => {
        const st = states[i] ?? "pending";

        if (karaokeMode) {
          // Show only correctly spoken words; mask the rest.
          return (
            <span
              key={i}
              className={st === "correct"
                ? "animate-pop font-semibold text-accent-text"
                : "select-none text-fg-muted/50"}
            >
              {st === "correct" ? w : "•".repeat(Math.max(2, normalizeWord(w).length))}
            </span>
          );
        }

        // Colour alone can't carry these states (WCAG 1.4.1): a correct word
        // also gains weight, and a mispronounced one keeps the wavy underline.
        const cls =
          st === "correct" ? "font-semibold text-accent-text"
          : st === "wrong" ? "font-semibold text-danger underline decoration-wavy decoration-2 underline-offset-4"
          : "text-fg-muted";

        return (
          <span key={i} className={`transition-colors duration-fast ${cls}`}>
            {w}
          </span>
        );
      })}
    </p>
  );
}
