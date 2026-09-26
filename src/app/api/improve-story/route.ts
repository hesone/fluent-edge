import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getLLM, llmLabel } from "@/lib/llm";
import { LANG_NAME } from "@/lib/i18n";
import { SPOKEN_RULES, STAGES } from "@/lib/interview";
import type { InterviewStage } from "@/store/useSessionStore";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Two phases so the candidate's facts stay theirs:
 *   phase "questions" → which facts are missing to close the evaluator's gaps
 *   phase "rewrite"   → a new version using only the story + the candidate's answers
 */
export async function POST(req: NextRequest) {
  const { phase, story, evaluation, answers, responsibility, company, stage, language } = await req.json();
  const meta = STAGES[stage as InterviewStage] ?? STAGES.ta;
  const langName = LANG_NAME[language] || "English";
  const companyName = company?.name?.trim() || "the company";

  const storyBlock = `STORY: "${story?.title}"
Situation: ${story?.situation}
Task: ${story?.task}
Action: ${story?.action}
Result: ${story?.result}`;

  const reviewBlock = `REVIEW BY ${meta.interviewer.toUpperCase()} AT ${companyName.toUpperCase()} (score ${evaluation?.score}/100):
Verdict: ${evaluation?.verdict}
Gaps: ${(evaluation?.gaps ?? []).join(" | ")}
Weak parts: ${Object.entries(evaluation?.parts ?? {})
    .filter(([, p]) => (p as { rating: string }).rating !== "strong")
    .map(([k, p]) => `${k}: ${(p as { note: string }).note}`)
    .join(" | ")}`;

  try {
    const { model, providerOptions } = await getLLM();

    if (phase === "questions") {
      const { output } = await generateText({
        model,
        temperature: 0.2,
        prompt: `You coach a candidate. The story below should show this responsibility: ${responsibility}

${storyBlock}

${reviewBlock}

Which FACTS does the candidate need to give you so the story can close these gaps? Ask 1 to 3 short, concrete questions only about facts that are not already in the story (numbers, scale, team size, their personal decision, outcome, what they learned). Do not ask about things you could fix just by rewording. If no new facts are needed, return an empty list.
All text must be in ${langName}.`,
        output: Output.object({ schema: z.object({ questions: z.array(z.string()) }) }),
        ...(providerOptions ? { providerOptions } : {}),
      });
      return NextResponse.json({ questions: (output?.questions ?? []).slice(0, 3) });
    }

    const qa = (Array.isArray(answers) ? answers : [])
      .filter((a: { answer?: string }) => a?.answer?.trim())
      .map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`)
      .join("\n");

    const { output } = await generateText({
      model,
      temperature: 0.3,
      prompt: `You coach a candidate for the ${meta.label} round at ${companyName}. Rewrite the STAR story so it closes the reviewer's gaps.

RESPONSIBILITY IT MUST SHOW: ${responsibility}

${storyBlock}

${reviewBlock}

${qa ? `NEW FACTS FROM THE CANDIDATE:\n${qa}` : "The candidate gave no new facts."}

Rules:
* Use ONLY facts from the original story and the new facts above. Never invent numbers, names, employers or outcomes. If a gap needs a fact you do not have, leave it out rather than guess.
* Improve focus, structure and relevance to the responsibility and to what ${companyName} needs now.
* situation, task, result: 1-3 spoken sentences each. action: 2-4 sentences, first person "I", the longest part.
* title: max 8 words.
* changes: 1-3 short notes on what you changed and why.
${SPOKEN_RULES}
All text must be in ${langName}.`,
      output: Output.object({
        schema: z.object({
          title: z.string(),
          situation: z.string(),
          task: z.string(),
          action: z.string(),
          result: z.string(),
          changes: z.array(z.string()),
        }),
      }),
      ...(providerOptions ? { providerOptions } : {}),
    });
    if (!output?.action) throw new Error("empty");
    return NextResponse.json(output);
  } catch (e) {
    console.log(e);
    return NextResponse.json(
      { error: "Improve failed", detail: String(e), provider: await llmLabel().catch(() => "the LLM") },
      { status: 500 }
    );
  }
}
