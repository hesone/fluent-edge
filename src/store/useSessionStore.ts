import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang, LangLevel } from "@/lib/i18n";

export type Converstion = "general" | "workspace";
export type Mode = "interview" | "professional";
export type Seniority = "junior" | "mid" | "senior";

/** Interview loop stage: Talent Acquisition, HR Manager, Engineering Manager, Senior Engineer. */
export type InterviewStage = "ta" | "hrm" | "enm" | "senior";
export const INTERVIEW_STAGES: InterviewStage[] = ["ta", "hrm", "enm", "senior"];

/** What kind of question it is — decides whether the ideal answer is a full STAR story. */
export type QuestionKind = "behavioural" | "technical" | "system-design" | "factual";

export interface StarParts {
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface StarStory extends StarParts {
  id: string;
  title: string;
  /** "ai" = drafted from the résumé, "user" = written from the learner's own answer. */
  source: "ai" | "user";
  approved: boolean;
}

export interface StoryPrompt {
  id: string;
  prompt: string;
  /** The learner's raw answer, before it is turned into a STAR story. */
  answer: string;
  /** Set once the answer has been converted into a story. */
  storyId?: string;
}

export interface Responsibility {
  id: string;
  title: string;
  summary: string;
  stories: StarStory[];
  prompts: StoryPrompt[];
}

/** STAR stories built for one job description. Keyed by a hash of the JD text. */
export interface StoryBank {
  jdKey: string;
  jobTitle: string;
  responsibilities: Responsibility[];
  updatedAt: number;
}

export interface QA {
  id: number;
  question: string;
  idealAnswer: string;
  stage?: InterviewStage;
  kind?: QuestionKind;
  /** Present for behavioural questions: the ideal answer split into S/T/A/R. */
  star?: StarParts;
  /** The responsibility from the JD this question probes, if any. */
  responsibility?: string;
}

/** Stable short key for a JD so the same posting reuses its story bank. */
export function jdKeyOf(text: string): string {
  const norm = text.replace(/\s+/g, " ").trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) | 0;
  return norm ? `jd_${(h >>> 0).toString(36)}_${norm.length}` : "";
}

export const MIN_APPROVED_STORIES = 2;

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
  // Devices chosen in the (optional) camera/mic check, reused for every question.
  videoDeviceId: string;
  audioDeviceId: string;

  convType: Converstion;
  langLevel: LangLevel,
  resumeText: string;
  situation: string;
  topic: string;
  language: Lang;
  mode: Mode;
  seniority: Seniority;
  stage: InterviewStage;
  jdText: string;
  storyBanks: Record<string, StoryBank>;
  questions: QA[];
  results: Record<number, QuestionResult>;
  // Preferred Q&A kept separately per conversation tab
  preferredQA: Record<Converstion, PreferredQA[]>;

  setDevices: (d: Partial<Pick<SessionState, "videoDeviceId" | "audioDeviceId">>) => void;
  setOnboarding: (d: Partial<Pick<SessionState, "resumeText" | "language" | "mode" | "topic" | "seniority" | "convType" | "langLevel" | "situation" | "stage" | "jdText">>) => void;
  setStoryBank: (bank: StoryBank) => void;
  updateResponsibility: (jdKey: string, respId: string, fn: (r: Responsibility) => Responsibility) => void;
  addPreferredQA: (tab: Converstion, question: string, answer: string) => void;
  updatePreferredQA: (tab: Converstion, id: number, d: Partial<Pick<PreferredQA, "question" | "answer">>) => void;
  removePreferredQA: (tab: Converstion, id: number) => void;
  setQuestions: (q: QA[]) => void;
  setAnswerForQuestion: (qId: number, a: string) => void;
  updateQuestion: (qId: number, d: Partial<Omit<QA, "id">>) => void;
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
      videoDeviceId: "",
      audioDeviceId: "",

      convType: "workspace",
      langLevel: "c1",
      resumeText: "",
      language: "en",
      topic: "",
      mode: "interview",
      seniority: "mid",
      stage: "ta",
      jdText: "",
      storyBanks: {},
      situation: "",
      questions: [],
      results: {},
      preferredQA: { general: [], workspace: [] },

      setDevices: (d) => set(d),
      setOnboarding: (d) => set(d),
      setStoryBank: (bank) =>
        set({ storyBanks: { ...get().storyBanks, [bank.jdKey]: { ...bank, updatedAt: Date.now() } } }),
      updateResponsibility: (jdKey, respId, fn) => {
        const bank = get().storyBanks[jdKey];
        if (!bank) return;
        set({
          storyBanks: {
            ...get().storyBanks,
            [jdKey]: {
              ...bank,
              updatedAt: Date.now(),
              responsibilities: bank.responsibilities.map((r) => (r.id === respId ? fn(r) : r)),
            },
          },
        });
      },
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
      updateQuestion: (qId, d) =>
        set({ questions: get().questions.map((q) => (q.id === qId ? { ...q, ...d } : q)) }),
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
        stage: s.stage, jdText: s.jdText, storyBanks: s.storyBanks,
        videoDeviceId: s.videoDeviceId, audioDeviceId: s.audioDeviceId,
      }),
    }
  )
);