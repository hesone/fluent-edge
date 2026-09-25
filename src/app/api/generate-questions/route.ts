import { NextRequest, NextResponse } from "next/server";
import { LANG_LEVEL, LANG_NAME } from "@/lib/i18n";
import { generateText, Output } from "ai";
import { getLLM, llmLabel } from "@/lib/llm";
import { z } from "zod";
import { STAGES, KIND_RULES, SPOKEN_RULES, mixText, storyBankBlock, joinStar, hasStar } from "@/lib/interview";
import type { InterviewStage, QuestionKind, Responsibility } from "@/store/useSessionStore";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const { resumeText, mode, seniority, language, convType, langLevel, situation, preferredQA, stage, jdText, responsibilities } = await req.json();
  const level = LANG_LEVEL[langLevel] || "C1";
  const langName = LANG_NAME[language] || "English";
  const genSituation = situation || 'in a random place or random situation'
  const modeDesc =
    mode === "interview"
      ? "a job interview"
      : "professional workplace communication scenarios";

  // User's preferred Q&A pairs (max 10, question required)
  const userQAs: { question: string; answer?: string }[] = (Array.isArray(preferredQA) ? preferredQA : [])
    .filter((x: { question?: string }) => typeof x?.question === "string" && x.question.trim().length > 0)
    .slice(0, 10);
  const remaining = 10 - userQAs.length;

  const preferredBlock = (targetDesc: string) =>
    userQAs.length === 0
      ? ""
      : `
The learner provided ${userQAs.length} PREFERRED question/answer pairs (may be in any language):
${userQAs.map((x, i) => `${i + 1}. Q: ${x.question}\n   A: ${x.answer?.trim() || "(no answer provided — write an ideal one)"}`).join("\n")}

Rules for the preferred pairs:
* Keep the meaning and intent of each question and answer.
* Rewrite BOTH the question and the answer into natural ${langName}, ${targetDesc}.
* If an answer is missing, write an ideal answer yourself.
* The preferred pairs must appear FIRST, with ids 1 to ${userQAs.length}.
${remaining > 0 ? `* Then generate ${remaining} ADDITIONAL related questions (ids ${userQAs.length + 1} to 10) on the same theme so the total is exactly 10.` : "* Do not add any extra questions beyond these 10."}
`;

  let prompt = `You are an expert ${langName} language coach and interviewer.
Based on this candidate resume, create exactly 10 questions for ${modeDesc} at a ${seniority}-level role.
For EACH question, also write an IDEAL spoken answer in ${langName}, 2-4 sentences, natural and confident, appropriate for a ${seniority} candidate.

RESUME:
"""
${resumeText || "No resume provided. Use general professional background."}
"""

${preferredBlock(`appropriate for a ${seniority}-level candidate in ${modeDesc}`)}

All text must be in ${langName}.

Return ONLY valid JSON in this exact shape:
{
  topic: ${seniority} - ${langName} - ${mode}
  questions: [{"id":1,"question":"...","idealAnswer":"..."}, ... 10 items]
}`;

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

${preferredBlock(`matching the vocabulary, grammar, sentence complexity, and fluency expected at ${level} (CEFR)`)}

Level guidelines:
* A1: very simple sentences, basic vocabulary.
* A2: simple conversations about daily life.
* B1: connected speech, opinions, experiences.
* B2: detailed explanations, advantages/disadvantages.
* C1: nuanced opinions and complex ideas.
* C2: near-native fluency and sophisticated expression.

All text must be in ${langName}.

Return ONLY valid JSON in this exact shape:
{
  topic: ${level} - ${langName} - Situation choosed by ai
  questions: [{"id":1,"question":"...","idealAnswer":"..."}, ... 10 items]
}`

}

  // Interview mode now runs per stage (TA / HRM / ENM / Senior Engineer) and
  // can draw on the JD and the learner's STAR story bank.
  if (convType !== "general" && mode === "interview") {
    return interviewStage({
      stage: (stage in STAGES ? stage : "ta") as InterviewStage,
      seniority, langName, resumeText, jdText,
      responsibilities: Array.isArray(responsibilities) ? responsibilities : [],
      userQAs, remaining, preferredBlock,
    });
  }

  try {
    const { model, providerOptions } = await getLLM();
    const { output } = await generateText({
      model,
      prompt: prompt,
      output: Output.object({
        schema: z.object({
          topic: z.string(),
          questions: z.array(
            z.object({
              id: z.number(),
              question: z.string(),
              idealAnswer: z.string(),
            })
          )
        })
      }),
      ...(providerOptions ? { providerOptions } : {}),
    });

    const topic = output.topic
    const questions: { id: number; question: string; idealAnswer: string }[] = output.questions || []  

    if (questions.length === 0) throw new Error("empty");
    return NextResponse.json({ questions, topic });
  } catch (e) {
    console.log(e)
    return NextResponse.json(
      { error: "Generation failed", detail: String(e), provider: await llmLabel().catch(() => "the LLM") },
      { status: 500 }
    );
  }
}

const KINDS = ["behavioural", "technical", "system-design", "factual"] as const;

async function interviewStage(o: {
  stage: InterviewStage;
  seniority: string;
  langName: string;
  resumeText?: string;
  jdText?: string;
  responsibilities: Responsibility[];
  userQAs: { question: string; answer?: string }[];
  remaining: number;
  preferredBlock: (targetDesc: string) => string;
}) {
  const meta = STAGES[o.stage];
  const bank = storyBankBlock(o.responsibilities);
  const jd = (o.jdText || "").trim();

  const prompt = `You are ${meta.interviewer}, and an expert ${o.langName} interview coach.
Prepare a realistic ${meta.label} (${meta.short}) interview round for a ${o.seniority}-level candidate.

THIS ROUND FOCUSES ON:
${meta.focus.map((f) => `* ${f}`).join("\n")}

${jd ? `JOB DESCRIPTION:\n"""\n${jd.slice(0, 12000)}\n"""\n` : "No job description provided. Assume a typical role matching the resume and seniority.\n"}
RESUME:
"""
${o.resumeText || "No resume provided. Use a general professional background."}
"""

${bank ? `KEY RESPONSIBILITIES OF THIS ROLE AND THE CANDIDATE'S APPROVED STAR STORIES:\n${bank}\n` : jd ? "First work out the key responsibilities of this role from the job description.\n" : ""}
${o.preferredBlock(`as questions a ${meta.label} would ask in this round`)}

Create exactly ${o.remaining > 0 ? 10 : o.userQAs.length} questions${o.userQAs.length ? " in total including the preferred ones" : ""}. For the questions you write yourself use this mix of kinds: ${mixText(o.stage, Math.max(o.remaining, 0))}.

For EACH question return:
* id: 1..N
* kind: one of "behavioural", "technical", "system-design", "factual"
* question: what the ${meta.label} would actually ask, tied to the key responsibilities of this role${jd ? " and the job description" : ""}
* responsibility: the title of the key responsibility it probes, or an empty string
* star: situation, task, action, result
* idealAnswer: the ideal spoken answer for a ${o.seniority} candidate

How to write the ideal answer for each kind:
${(Object.keys(KIND_RULES) as QuestionKind[]).map((k) => `* ${k}: ${KIND_RULES[k]}`).join("\n")}

${bank ? `Rules for behavioural answers: build each one from ONE of the approved STAR stories above that fits the question, preferring the candidate's own stories. Use each story at most once. Keep the facts of the story; only adapt the wording to the question. Spread questions across the responsibilities.` : "Rules for behavioural answers: base them on concrete experience from the resume."}
Never invent employers or facts that contradict the resume.
${SPOKEN_RULES}
All text must be in ${o.langName}.`;

  try {
    const { model, providerOptions } = await getLLM();
    const { output } = await generateText({
      model,
      prompt,
      output: Output.object({
        schema: z.object({
          questions: z.array(
            z.object({
              id: z.number(),
              kind: z.string(),
              question: z.string(),
              responsibility: z.string(),
              star: z.object({
                situation: z.string(),
                task: z.string(),
                action: z.string(),
                result: z.string(),
              }),
              idealAnswer: z.string(),
            })
          ),
        }),
      }),
      ...(providerOptions ? { providerOptions } : {}),
    });

    const questions = (output?.questions ?? []).map((q, i) => {
      const kind: QuestionKind = (KINDS as readonly string[]).includes(q.kind) ? (q.kind as QuestionKind) : "behavioural";
      const star = kind === "behavioural" && hasStar(q.star) ? q.star : undefined;
      return {
        id: i + 1,
        question: q.question,
        stage: o.stage,
        kind,
        responsibility: q.responsibility || undefined,
        star,
        idealAnswer: q.idealAnswer?.trim() || (star ? joinStar(star) : ""),
      };
    });
    if (questions.length === 0) throw new Error("empty");
    return NextResponse.json({ questions, topic: `${o.seniority} - ${o.langName} - interview` });
  } catch (e) {
    console.log(e);
    return NextResponse.json(
      { error: "Generation failed", detail: String(e), provider: await llmLabel().catch(() => "the LLM") },
      { status: 500 }
    );
  }
}
