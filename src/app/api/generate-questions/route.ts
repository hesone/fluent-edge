import { NextRequest, NextResponse } from "next/server";
import { ollamaGenerate, safeJSON } from "@/lib/ollama";

export const runtime = "nodejs";
export const maxDuration = 120;

const LANG_NAME: Record<string, string> = {
  en: "English", de: "German", fr: "French", es: "Spanish", fa: "Farsi (Persian)",
};

export async function POST(req: NextRequest) {
  const { resumeText, mode, seniority, language } = await req.json();
  const langName = LANG_NAME[language] || "English";
  const modeDesc =
    mode === "interview"
      ? "a job interview"
      : "professional workplace communication scenarios";

  const prompt = `You are an expert ${langName} language coach and interviewer.
Based on this candidate resume, create exactly 10 questions for ${modeDesc} at a ${seniority}-level role.
For EACH question, also write an IDEAL spoken answer in ${langName}, 2-4 sentences, natural and confident, appropriate for a ${seniority} candidate.

RESUME:
"""
${resumeText || "No resume provided. Use general professional background."}
"""

Return ONLY valid JSON in this exact shape:
{"questions":[{"id":1,"question":"...","idealAnswer":"..."}, ... 10 items]}
All text must be in ${langName}.`;

  try {
    const raw = await ollamaGenerate(prompt, { json: true });
    const parsed = safeJSON<{ questions: { id: number; question: string; idealAnswer: string }[] }>(
      raw, { questions: [] }
    );
    let questions = parsed.questions || [];
    questions = questions.slice(0, 10).map((q, i) => ({
      id: i + 1,
      question: String(q.question || `Question ${i + 1}`),
      idealAnswer: String(q.idealAnswer || ""),
    }));
    if (questions.length === 0) throw new Error("empty");
    return NextResponse.json({ questions });
  } catch (e) {
    return NextResponse.json({ error: "Generation failed", detail: String(e) }, { status: 500 });
  }
}