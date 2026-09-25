import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getLLM, llmLabel } from "@/lib/llm";
import { LANG_NAME } from "@/lib/i18n";
import { SPOKEN_RULES } from "@/lib/interview";

export const runtime = "nodejs";
export const maxDuration = 120;

const star = z.object({
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
});

/**
 * Step 1 of the interview flow: read the JD, pull out the key responsibilities,
 * draft two STAR stories per responsibility from the résumé, and write the
 * prompts that will draw more stories out of the candidate.
 */
export async function POST(req: NextRequest) {
  const { jdText, resumeText, language, seniority } = await req.json();
  const langName = LANG_NAME[language] || "English";

  if (!jdText || String(jdText).trim().length < 40) {
    return NextResponse.json({ error: "Job description is too short", detail: "Paste the full job description." }, { status: 400 });
  }

  const prompt = `You are an expert interview coach who prepares candidates with the STAR method (Situation, Task, Action, Result).

JOB DESCRIPTION:
"""
${String(jdText).slice(0, 12000)}
"""

CANDIDATE RESUME:
"""
${resumeText || `No resume provided. Infer a realistic background for a ${seniority}-level candidate applying to this role.`}
"""

Do these three things:

1. KEY RESPONSIBILITIES — What are the key responsibilities of this role? Extract the 5 to 7 most important ones from the job description, most important first. Each has a short title (max 8 words) and a one-sentence summary of what the role expects.

2. STAR STORIES — For EACH responsibility create exactly 2 STAR stories that the candidate could tell in an interview. Base them on real experience from the resume: employers, projects, technologies and numbers that appear there. If the resume has no direct evidence, write a realistic story consistent with the resume and a ${seniority}-level candidate, without inventing new employers. Each story has a short title (max 8 words) and situation, task, action, result of 1-3 spoken sentences each. Action uses "I" and shows the candidate's own decisions; Result is concrete and measurable where possible.

3. PROMPTS FOR MORE STORIES — For EACH responsibility write exactly 3 short, targeted prompts that ask the candidate to recall ADDITIONAL experiences that would showcase this responsibility, for example "Tell me about a time you had to …" or "Think of a project where you …". Make them cover angles the two drafted stories do not (a failure or lesson, a conflict or stakeholder angle, a scale or impact angle).

Also return jobTitle: the job title from the JD.

${SPOKEN_RULES}
All text must be in ${langName}.`;

  try {
    const { model, providerOptions } = await getLLM();
    const { output } = await generateText({
      model,
      prompt,
      output: Output.object({
        schema: z.object({
          jobTitle: z.string(),
          responsibilities: z.array(
            z.object({
              title: z.string(),
              summary: z.string(),
              stories: z.array(star),
              prompts: z.array(z.string()),
            })
          ),
        }),
      }),
      ...(providerOptions ? { providerOptions } : {}),
    });

    if (!output?.responsibilities?.length) throw new Error("no responsibilities came back");
    return NextResponse.json(output);
  } catch (e) {
    console.log(e);
    return NextResponse.json(
      { error: "Generation failed", detail: String(e), provider: await llmLabel().catch(() => "the LLM") },
      { status: 500 }
    );
  }
}
