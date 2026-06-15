import { NextRequest, NextResponse } from "next/server";
import { ollamaGenerate, safeJSON } from "@/lib/ollama";

export const runtime = "nodejs";
export const maxDuration = 120;

const LANG_NAME: Record<string, string> = {
  en: "English", de: "German", fr: "French", es: "Spanish", fa: "Farsi (Persian)",
};

const LANG_LEVEL: Record<string, string> = {
  a1: "A1", a2: "A2", b1: "B1", b2: "B2", c1: "C1", c2: "C2",
};

export async function POST(req: NextRequest) {
  const { resumeText, mode, seniority, language, convType, langLevel } = await req.json();
  const level = LANG_LEVEL[langLevel] || "C1";
  const langName = LANG_NAME[language] || "English";
  const modeDesc =
    mode === "interview"
      ? "a job interview"
      : "professional workplace communication scenarios";

  let prompt = `You are an expert ${langName} language coach and interviewer.
Based on this candidate resume, create exactly 10 questions for ${modeDesc} at a ${seniority}-level role.
For EACH question, also write an IDEAL spoken answer in ${langName}, 2-4 sentences, natural and confident, appropriate for a ${seniority} candidate.

RESUME:
"""
${resumeText || "No resume provided. Use general professional background."}
"""

Return ONLY valid JSON in this exact shape:
{"questions":[{"id":1,"question":"...","idealAnswer":"..."}, ... 10 items]}
All text must be in ${langName}.`;

if(convType === 'general'){
  prompt = `You are an expert ${langName} language teacher.
Create exactly 10 everyday conversation questions suitable for a learner at ${level} level according to the CEFR framework.

For EACH question:
* Write a natural question in ${langName}.
* Write an IDEAL answer in ${langName}.
* The answer must match the vocabulary, grammar, sentence complexity, and fluency expected ${level}.
* Use only language appropriate for ${level}.
* Do not include emojis, bullet points, quotation marks, parentheses, stage directions, sound effects, labels, markdown, or any special symbols that would not normally be spoken.
* The ideal answer must contain plain spoken text only.
* Keep answers realistic and conversational.
* Avoid technical, academic, or job-specific topics unless they are appropriate for ${level}.

Level guidelines:
* A1: very simple sentences, basic vocabulary.
* A2: simple conversations about daily life.
* B1: connected speech, opinions, experiences.
* B2: detailed explanations, advantages/disadvantages.
* C1: nuanced opinions and complex ideas.
* C2: near-native fluency and sophisticated expression.

Return ONLY valid JSON in this exact shape:
{"questions":[{"id":1,"question":"...","idealAnswer":"..."}, ... 10 items]}
All text must be in ${langName}.`
}

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