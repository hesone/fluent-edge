export type Lang = "en" | "de" | "fr" | "es" | "fa";

export const LANGS: { code: Lang; label: string; flag: string; rtl: boolean }[] = [
  { code: "en", label: "English", flag: "🇬🇧", rtl: false },
  { code: "de", label: "Deutsch", flag: "🇩🇪", rtl: false },
  { code: "fr", label: "Français", flag: "🇫🇷", rtl: false },
  { code: "es", label: "Español", flag: "🇪🇸", rtl: false },
  { code: "fa", label: "فارسی", flag: "🇮🇷", rtl: true },
];

export const isRTL = (lang: Lang) => lang === "fa";

const dict = {
  en: {
    appName: "FluentEdge",
    tagline: "Master English with AI-powered practice",
    uploadResume: "Upload your resume (PDF)",
    chooseLanguage: "Practice language",
    chooseMode: "Practice mode",
    chooseSeniority: "Seniority level",
    interview: "Interview Practice",
    professional: "Professional Communication",
    junior: "Junior", mid: "Mid", senior: "Senior",
    generate: "Generate My Questions",
    generating: "Building your personalized session…",
    readyToPractice: "I'm ready to practice this",
    questionOf: "Question {n} of {total}",
    idealAnswer: "Ideal Answer",
    nextQuestion: "Next Question",
    showHint: "Show hint",
    startSession: "Start Session",
    yourScores: "Your Scores",
    faceScore: "Face Confidence",
    grammarScore: "Grammar / Pronunciation",
    combined: "Combined",
    practiceAgain: "Practice again",
    replay: "Replay",
    perfect: "Perfect! 🎉",
    allPerfect: "Flawless! You aced every question!",
    liveTranscript: "Live transcript",
    skipQuestion: "Skip",
    scoring: "Scoring...",
    startRecording: "Start Recording",
    stopRecording: "Stop Recording",
    stopped: "Stopped",
    general: "General",
    workspace: "Workspace",
    chooseConv: "Conversation type",
    chooseLangLevel: "Language level",
    langLevels: { a1: 'A1', a2: 'A2', b1: 'B2', b2: 'B2', c1: 'C1', c2: 'C2' }
  },
} as const;

// Other langs fall back to English keys for brevity (UI labels still localized via dict.en)
export const t = (lang: Lang, key: keyof typeof dict.en, vars?: Record<string, string | number>) => {
  let s: string = dict.en[key];
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
  return s;
};