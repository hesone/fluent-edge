import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "@/lib/i18n";

export type Mode = "interview" | "professional";
export type Seniority = "junior" | "mid" | "senior";

export interface QA {
  id: number;
  question: string;
  idealAnswer: string;
}

export interface QuestionResult {
  faceScore: number;       // 0-100
  grammarScore: number;    // 0-100 (from Ollama)
  pronunciationScore: number;
  combinedScore: number;
  feedback: string;
  seniorityMatch: Seniority | null;
  transcript: string;
  videoUrl: string | null; // object URL of recording
  completed: boolean;
}

interface SessionState {
  resumeText: string;
  language: Lang;
  mode: Mode;
  seniority: Seniority;
  questions: QA[];
  results: Record<number, QuestionResult>;

  setOnboarding: (d: Partial<Pick<SessionState, "resumeText" | "language" | "mode" | "seniority">>) => void;
  setQuestions: (q: QA[]) => void;
  saveResult: (id: number, r: Partial<QuestionResult>) => void;
  reset: () => void;
}

const emptyResult = (): QuestionResult => ({
  faceScore: 0, grammarScore: 0, pronunciationScore: 0, combinedScore: 0,
  feedback: "", seniorityMatch: null, transcript: "", videoUrl: null, completed: false,
});

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      resumeText: "",
      language: "en",
      mode: "interview",
      seniority: "mid",
      questions: [],
      results: {},

      setOnboarding: (d) => set(d),
      setQuestions: (questions) =>
        set({
          questions,
          results: Object.fromEntries(questions.map((q) => [q.id, emptyResult()])),
        }),
      saveResult: (id, r) => {
        const cur = get().results[id] ?? emptyResult();
        const merged = { ...cur, ...r };
        // recompute combined when face+grammar present
        merged.combinedScore = Math.round(
          0.5 * merged.faceScore + 0.5 * ((merged.grammarScore + merged.pronunciationScore) / 2 * 2) / 2
        );
        // simpler: average of face & grammar
        merged.combinedScore = Math.round((merged.faceScore + merged.grammarScore) / 2);
        set({ results: { ...get().results, [id]: merged } });
      },
      reset: () => set({ resumeText: "", questions: [], results: {} }),
    }),
    {
      name: "fluentedge-session",
      // videoUrl object URLs aren't serializable across reloads; that's acceptable.
      partialize: (s) => ({
        resumeText: s.resumeText, language: s.language, mode: s.mode,
        seniority: s.seniority, questions: s.questions, results: s.results
      }),
    }
  )
);