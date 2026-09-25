"use client";
// Client helpers shared by set-up and the Story Bank page.

import { useSessionStore, jdKeyOf, type QA } from "@/store/useSessionStore";
import { APP_MODE } from "@/lib/config";

/** Ask the server for this session's questions, using everything in the store. */
export async function requestQuestions(): Promise<{ questions: QA[]; topic: string }> {
  const s = useSessionStore.getState();
  const interview = s.convType === "workspace" && s.mode === "interview";
  const bank = interview && s.jdText.trim() ? s.storyBanks[jdKeyOf(s.jdText)] : undefined;

  const res = await fetch("/api/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      convType: s.convType, langLevel: s.langLevel, resumeText: s.resumeText, mode: s.mode,
      seniority: s.seniority, language: s.language, situation: s.situation,
      preferredQA: s.preferredQA[s.convType] ?? [],
      ...(interview ? { stage: s.stage, jdText: s.jdText, responsibilities: bank?.responsibilities ?? [] } : {}),
    }),
  });
  const data = await res.json();
  if (!data.questions?.length) {
    // The route reports which backend it was talking to, so the message can
    // name the thing to go start instead of guessing.
    throw new Error(
      [data.provider && `via ${data.provider}`, data.detail || "no questions came back"].filter(Boolean).join(" — ")
    );
  }
  return data;
}

export function llmErrorMessage(e: unknown): string {
  return APP_MODE === "local"
    ? `We couldn't reach your local model. Is Ollama running? Start it with \`ollama serve\`. (${String(e)})`
    : `We couldn't build your session. Check your OpenRouter key and your connection, then try again. (${String(e)})`;
}
