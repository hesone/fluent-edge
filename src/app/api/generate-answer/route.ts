import { Mode } from "@/store/useSessionStore";
import { generateText, Output, streamText } from "ai";
import { z } from "zod";
import { LANG_NAME } from "@/lib/i18n";
import { STAGES, KIND_RULES, SPOKEN_RULES, storyBankBlock, joinStar, hasStar } from "@/lib/interview";
import type { InterviewStage, QuestionKind, Responsibility } from "@/store/useSessionStore";
import { getLLM, llmLabel } from "@/lib/llm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { question, topic, resume } = body;
    // Interview-stage questions carry a kind; they get a kind-aware answer
    // (and a S/T/A/R split for behavioural ones) returned as JSON.
    if (body.kind && body.stage) return stageAnswer(body);
    const [level, langName, sitaution] = topic.split('-')
    const prompt = (resume || (['interview', 'professional'] as Mode[]).includes(sitaution.trim())) ?
    `You are an expert ${langName} language coach and interviewer.
Based on this candidate resume, create an answer for this question "${question}" at a ${level}-level role.
The IDEAL spoken answer in ${langName}, 1-3 sentences, natural and confident, appropriate for a ${level} candidate.

RESUME:
"""
${resume || "No resume provided. Use general professional background."}
"""

Answer do not include emojis, bullet points, quotation marks, parentheses, stage directions, sound effects, labels, markdown, or any special symbols that would not normally be spoken.
Answer must be in ${langName}.

Return a text as an answer without any additional note.
` :
`You are an expert native ${langName} language teacher.
Create an answer for this conversation question ${question} suitable for a learner at ${level} level according to the CEFR framework and according to the learner wanna be ${sitaution}

ANSWER RULES:
* Write an IDEAL answer in ${langName} for this question "${question}".
* The answer must match the vocabulary, grammar, sentence complexity, and fluency expected ${level}.
* Use only language appropriate for ${level} in 1-4 sentences.
* Do not include emojis, bullet points, quotation marks, parentheses, stage directions, sound effects, labels, markdown, or any special symbols that would not normally be spoken.
* The ideal answer must contain plain spoken text only.
* Keep answer realistic and conversational.
* Avoid technical, academic, or job-specific topics unless they are appropriate for ${level}.
* Assume user is ${sitaution} and answer must be releated to this situation.

Level guidelines:
* A1: very simple sentences, basic vocabulary.
* A2: simple conversations about daily life.
* B1: connected speech, opinions, experiences.
* B2: detailed explanations, advantages/disadvantages.
* C1: nuanced opinions and complex ideas.
* C2: near-native fluency and sophisticated expression.

All text must be in ${langName}.

Return a text as an answer.
`

  try {
    const { model, providerOptions } = await getLLM();
    const result = streamText({
      model,
      prompt: prompt,
      ...(providerOptions ? { providerOptions } : {}),
    });

    if (!result.text) throw new Error("empty");
    
    return result.toTextStreamResponse()
  } catch (e) {
    console.log(e)
    return NextResponse.json(
      { error: "Generation failed", detail: String(e), provider: await llmLabel().catch(() => "the LLM") },
      { status: 500 }
    );
  }
}

async function stageAnswer(b: {
  question: string; kind: QuestionKind; stage: InterviewStage; seniority?: string; language?: string;
  resume?: string; jdText?: string; responsibility?: string; responsibilities?: Responsibility[];
}) {
  const meta = STAGES[b.stage] ?? STAGES.ta;
  const langName = LANG_NAME[b.language || "en"] || "English";
  const kind: QuestionKind = b.kind in KIND_RULES ? b.kind : "behavioural";
  const bank = storyBankBlock(b.responsibilities);
  const prompt = `You are ${meta.interviewer}, and an expert ${langName} interview coach.
Write a DIFFERENT ideal spoken answer for a ${b.seniority || "mid"}-level candidate to this ${meta.label} interview question:
"${b.question}"
${b.responsibility ? `It probes this key responsibility of the role: ${b.responsibility}` : ""}

${b.jdText ? `JOB DESCRIPTION:\n"""\n${String(b.jdText).slice(0, 8000)}\n"""` : ""}
RESUME:
"""
${b.resume || "No resume provided. Use a general professional background."}
"""
${bank ? `\nAPPROVED STAR STORIES (prefer the candidate's own; pick the one that best fits):\n${bank}\n` : ""}
Kind of question: ${kind}. ${KIND_RULES[kind]}
Never invent employers or facts that contradict the resume.
${SPOKEN_RULES}
All text must be in ${langName}.`;

  try {
    const { model, providerOptions } = await getLLM();
    const { output } = await generateText({
      model,
      prompt,
      output: Output.object({
        schema: z.object({
          star: z.object({ situation: z.string(), task: z.string(), action: z.string(), result: z.string() }),
          idealAnswer: z.string(),
        }),
      }),
      ...(providerOptions ? { providerOptions } : {}),
    });
    const star = kind === "behavioural" && hasStar(output?.star) ? output.star : undefined;
    const idealAnswer = output?.idealAnswer?.trim() || (star ? joinStar(star) : "");
    if (!idealAnswer) throw new Error("empty");
    return NextResponse.json({ idealAnswer, star });
  } catch (e) {
    console.log(e);
    return NextResponse.json(
      { error: "Generation failed", detail: String(e), provider: await llmLabel().catch(() => "the LLM") },
      { status: 500 }
    );
  }
}
