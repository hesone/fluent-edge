import { NextRequest, NextResponse } from "next/server";
import { LANG_LEVEL, LANG_NAME } from "@/lib/i18n";
import { generateText, Output } from "ai";
import { createOllama } from "ai-sdk-ollama";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 120;

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

const ollamaGenerate = createOllama({
  baseURL: OLLAMA_URL
});

export async function POST(req: NextRequest) {
  const { resumeText, mode, seniority, language, convType, langLevel, situation } = await req.json();
  const level = LANG_LEVEL[langLevel] || "C1";
  const langName = LANG_NAME[language] || "English";
  const genSituation = situation || 'in a random place or random situation'
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

All text must be in ${langName}.

Return ONLY valid JSON in this exact shape:
[{"id":1,"question":"...","idealAnswer":"..."}, ... 10 items]`;

if(convType === 'general'){
  prompt = `You are an expert native ${langName} language teacher.
Create exactly 10 conversation questions suitable for a learner at ${level} level according to the CEFR framework and according to the learner wanna be ${genSituation}

For EACH question:
* Write a natural question in ${langName}.
* Write an IDEAL answer in ${langName}.
* The answer must match the vocabulary, grammar, sentence complexity, and fluency expected ${level}.
* Use only language appropriate for ${level}.
* Do not include emojis, bullet points, quotation marks, parentheses, stage directions, sound effects, labels, markdown, or any special symbols that would not normally be spoken.
* The ideal answer must contain plain spoken text only.
* Keep answers realistic and conversational.
* Avoid technical, academic, or job-specific topics unless they are appropriate for ${level}.
* Assume user is ${genSituation} and questions and answers must be releated to this situation.

Level guidelines:
* A1: very simple sentences, basic vocabulary.
* A2: simple conversations about daily life.
* B1: connected speech, opinions, experiences.
* B2: detailed explanations, advantages/disadvantages.
* C1: nuanced opinions and complex ideas.
* C2: near-native fluency and sophisticated expression.

All text must be in ${langName}.

Return ONLY valid JSON in this exact shape:
[{"id":1,"question":"...","idealAnswer":"..."}, ... 10 items]`

}

  try {
    const { output } = await generateText({
      model: ollamaGenerate(MODEL),
      prompt: prompt,
      output: Output.object({
        schema: z.array(
          z.object({
            id: z.number(),
            question: z.string(),
            idealAnswer: z.string(),
          })
        ),
      }),
      providerOptions: {
        ollama: {
          format: "json",
        },
      }
    });

    let questions: { id: number; question: string; idealAnswer: string }[] = output || []  

    if (questions.length === 0) throw new Error("empty");
    return NextResponse.json({ questions });
  } catch (e) {
    console.log(e)
    return NextResponse.json({ error: "Generation failed", detail: String(e) }, { status: 500 });
  }
}