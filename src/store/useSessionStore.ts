import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang, LangLevel } from "@/lib/i18n";

export type Converstion = "general" | "workspace";
export type Mode = "interview" | "professional";
export type Seniority = "junior" | "mid" | "senior";

export interface QA {
  id: number;
  question: string;
  idealAnswer: string;
}

export interface PreferredQA {
  id: number;
  question: string;
  answer: string;
}

export const MAX_PREFERRED_QA = 10;

export interface QuestionResult {
  faceScore: number;       // 0-100
  grammarScore: number;    // 0-100 (from AI grammar check)
  pronunciationScore: number;
  combinedScore: number;
  feedback: string;
  seniorityMatch: Seniority | null;
  transcript: string;
  videoUrl: string | null; // object URL of recording
  completed: boolean;
}

interface SessionState {
  convType: Converstion;
  langLevel: LangLevel,
  resumeText: string;
  situation: string;
  topic: string;
  language: Lang;
  mode: Mode;
  seniority: Seniority;
  questions: QA[];
  results: Record<number, QuestionResult>;
  // Preferred Q&A kept separately per conversation tab
  preferredQA: Record<Converstion, PreferredQA[]>;

  setOnboarding: (d: Partial<Pick<SessionState, "resumeText" | "language" | "mode" | "topic" | "seniority" | "convType" | "langLevel" | "situation">>) => void;
  addPreferredQA: (tab: Converstion, question: string, answer: string) => void;
  updatePreferredQA: (tab: Converstion, id: number, d: Partial<Pick<PreferredQA, "question" | "answer">>) => void;
  removePreferredQA: (tab: Converstion, id: number) => void;
  setQuestions: (q: QA[]) => void;
  setAnswerForQuestion: (qId: number, a: string) => void;
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
      convType: "workspace",
      langLevel: "c1",
      resumeText: "",
      language: "en",
      topic: "",
      mode: "interview",
      seniority: "mid",
      situation: "",
      questions: [],
      results: {},
      preferredQA: { general: [], workspace: [] },

      setOnboarding: (d) => set(d),
      addPreferredQA: (tab, question, answer) => {
        const list = get().preferredQA[tab];
        if (list.length >= MAX_PREFERRED_QA) return;
        const nextId = list.length ? Math.max(...list.map((x) => x.id)) + 1 : 1;
        set({
          preferredQA: { ...get().preferredQA, [tab]: [...list, { id: nextId, question, answer }] },
        });
      },
      updatePreferredQA: (tab, id, d) => {
        set({
          preferredQA: {
            ...get().preferredQA,
            [tab]: get().preferredQA[tab].map((x) => (x.id === id ? { ...x, ...d } : x)),
          },
        });
      },
      removePreferredQA: (tab, id) => {
        set({
          preferredQA: {
            ...get().preferredQA,
            [tab]: get().preferredQA[tab].filter((x) => x.id !== id),
          },
        });
      },
      setQuestions: (questions) =>
        set({
          questions,
          results: Object.fromEntries(questions.map((q) => [q.id, emptyResult()])),
        }),
      setAnswerForQuestion: (qId, answer) => {
        set({
          questions: get().questions.map(question => (question.id === qId ? { ...question, idealAnswer: answer }: question))
        })
      },
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
        seniority: s.seniority, questions: s.questions, results: s.results,
        convType: s.convType, langLevel: s.langLevel, situation: s.situation,
        topic: s.topic, preferredQA: s.preferredQA,
      }),
    }
  )
);