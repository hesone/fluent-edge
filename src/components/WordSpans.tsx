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
          // show only correctly spoken words; mask the rest
          return (
            <span key={i} className={st === "correct" ? "text-green-400 animate-pop font-semibold" : "select-none text-slate-700"}>
              {st === "correct" ? w : "•".repeat(Math.max(2, normalizeWord(w).length))}
            </span>
          );
        }
        const cls =
          st === "correct" ? "text-green-400 font-semibold"
          : st === "wrong" ? "text-red-400 underline decoration-wavy"
          : "text-slate-400";
        return <span key={i} className={`transition-colors duration-200 ${cls}`}>{w}</span>;
      })}
    </p>
  );
}