import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateText, Output } from "ai";
import { getLLM, llmLabel } from "@/lib/llm";

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
    const { model, providerOptions } = await getLLM();
    const { output } = await generateText({
      model,
      prompt: prompt,
      output: Output.object({
        schema: z.object({
          score: z.number(),
          feedback: z.string(),
          seniority_match: z.string(),
        })
      }),
      ...(providerOptions ? { providerOptions } : {}),
    });

    const parsed = output || { score: 60, feedback: "Good attempt.", seniority_match: seniority };
    const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 60)));
    const sm = ["junior", "mid", "senior"].includes(parsed.seniority_match)
      ? parsed.seniority_match : seniority;
    return NextResponse.json({ score, feedback: parsed.feedback || "", seniority_match: sm });
  } catch (e) {
    return NextResponse.json(
      { error: "Grading failed", detail: String(e), provider: await llmLabel().catch(() => "the LLM") },
      { status: 500 }
    );
  }
}