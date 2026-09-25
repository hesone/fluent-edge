import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getLLM, llmLabel } from "@/lib/llm";
import { LANG_NAME } from "@/lib/i18n";
import { SPOKEN_RULES } from "@/lib/interview";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Turn the candidate's own free-form recollection into a STAR story, and say
 * what is missing so the UI can nudge them for more detail.
 */
export async function POST(req: NextRequest) {
  const { responsibility, prompt: storyPrompt, answer, language, seniority } = await req.json();
  const langName = LANG_NAME[language] || "English";

  if (!answer || String(answer).trim().length < 20) {
    return NextResponse.json({ error: "Answer too short", detail: "Write or say a few sentences first." }, { status: 400 });
  }

  const prompt = `You are an expert interview coach. A ${seniority}-level candidate answered a prompt to recall an experience.
Rewrite their answer as a STAR story (Situation, Task, Action, Result) they can tell in an interview.

RESPONSIBILITY IT SHOULD SHOWCASE: ${responsibility}
PROMPT THEY ANSWERED: ${storyPrompt}
CANDIDATE'S ANSWER (may be in any language, may be rough notes):
"""
${String(answer).slice(0, 4000)}
"""

Rules:
* Keep to the facts the candidate gave. Do not invent employers, numbers or outcomes. If something is missing, write the part as well as the facts allow.
* situation, task, action, result: 1-3 spoken sentences each. Action uses "I" and is the longest part.
* title: max 8 words.
* missing: a short list (0-3 items) of details that would make the story stronger, phrased as questions to the candidate, e.g. "What was the measurable result?". Empty if nothing important is missing.
${SPOKEN_RULES}
All text must be in ${langName}.`;

  try {
    const { model, providerOptions } = await getLLM();
    const { output } = await generateText({
      model,
      prompt,
      output: Output.object({
        schema: z.object({
          title: z.string(),
          situation: z.string(),
          task: z.string(),
          action: z.string(),
          result: z.string(),
          missing: z.array(z.string()),
        }),
      }),
      ...(providerOptions ? { providerOptions } : {}),
    });
    if (!output?.action) throw new Error("empty");
    return NextResponse.json(output);
  } catch (e) {
    console.log(e);
    return NextResponse.json(
      { error: "Generation failed", detail: String(e), provider: await llmLabel().catch(() => "the LLM") },
      { status: 500 }
    );
  }
}
