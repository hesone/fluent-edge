import { NextRequest, NextResponse } from "next/server";
import { ollamaGenerate, safeJSON } from "@/lib/ollama";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { question, idealAnswer, userAnswer, seniority, language } = await req.json();

  const prompt = `You are a strict but fair ${language} language examiner.
Compare the CANDIDATE answer to the IDEAL answer for this question.
Grade grammar, vocabulary, fluency, and relevance.

QUESTION: ${question}
IDEAL ANSWER: ${idealAnswer}
CANDIDATE ANSWER: ${userAnswer}
TARGET SENIORITY: ${seniority}

Return ONLY JSON:
{"score": <0-100 integer>, "feedback": "<1-2 sentence constructive feedback>", "seniority_match": "junior"|"mid"|"senior"}`;

  try {
    const raw = await ollamaGenerate(prompt, { json: true });
    const parsed = safeJSON<{ score: number; feedback: string; seniority_match: string }>(
      raw, { score: 60, feedback: "Good attempt.", seniority_match: seniority }
    );
    const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 60)));
    const sm = ["junior", "mid", "senior"].includes(parsed.seniority_match)
      ? parsed.seniority_match : seniority;
    return NextResponse.json({ score, feedback: parsed.feedback || "", seniority_match: sm });
  } catch (e) {
    return NextResponse.json({ error: "Grading failed", detail: String(e) }, { status: 500 });
  }
}