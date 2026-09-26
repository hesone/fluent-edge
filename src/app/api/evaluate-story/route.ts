import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getLLM, llmLabel } from "@/lib/llm";
import { LANG_NAME } from "@/lib/i18n";
import { STAGES } from "@/lib/interview";
import type { InterviewStage } from "@/store/useSessionStore";

export const runtime = "nodejs";
export const maxDuration = 60;

const RATINGS = ["strong", "ok", "weak", "missing"] as const;
const part = z.object({ rating: z.string(), note: z.string() });

/**
 * Role-play review of one STAR story: the interviewer for the chosen stage
 * judges how well it covers one responsibility, as this company needs it now.
 * Input is kept small on purpose: the story, the responsibility, the other
 * responsibility titles and the company profile — not the whole JD or CV.
 */
export async function POST(req: NextRequest) {
  const { story, responsibility, responsibilities, jobTitle, company, stage, seniority, language } = await req.json();
  const meta = STAGES[stage as InterviewStage] ?? STAGES.ta;
  const langName = LANG_NAME[language] || "English";
  const companyName = company?.name?.trim() || "the company";
  const companyText = String(company?.text || "").trim().slice(0, 3000);

  const prompt = `Role-play. You are ${meta.interviewer} at ${companyName}, hiring a ${seniority || "mid"}-level ${jobTitle || "candidate"}.
In this round you care about:
${meta.focus.map((f) => `* ${f}`).join("\n")}

WHAT YOU KNOW ABOUT ${companyName.toUpperCase()} RIGHT NOW:
${companyText || "No company profile given. Judge against the responsibility and a typical company hiring for this role, and say that the company context is missing."}

KEY RESPONSIBILITIES OF THE ROLE:
${(Array.isArray(responsibilities) ? responsibilities : []).map((r: string) => `* ${r}`).join("\n") || "* (not provided)"}

THE STORY IS MEANT TO SHOW THIS RESPONSIBILITY:
${responsibility}

THE CANDIDATE'S STAR STORY: "${story?.title}"
Situation: ${story?.situation}
Task: ${story?.task}
Action: ${story?.action}
Result: ${story?.result}

Evaluate the story as you, this interviewer, would hear it in your round. Judge how well it covers the responsibility as ${companyName} needs it at its current stage — scale, challenges, tech and values from the profile — not in general.

Return:
* score: integer 0-100 for coverage from your perspective. 85+ = would clearly convince you; 60-84 = good but with gaps; below 60 = does not yet show it.
* verdict: one sentence, in your voice.
* voice: one or two sentences in first person, in character, e.g. "As the Engineering Manager at ${companyName}, what I want to hear is ...".
* parts: for situation, task, action and result give rating (one of: strong, ok, weak, missing) and a one-sentence note.
* strengths: 1-3 short points that already land with you.
* gaps: 1-3 short points missing relative to what ${companyName} needs now, each concrete (what to add).

Be honest and specific, not generic. Never suggest inventing facts.
All text must be in ${langName}.`;

  try {
    const { model, providerOptions } = await getLLM();
    const { output } = await generateText({
      model,
      prompt,
      temperature: 0.2,
      output: Output.object({
        schema: z.object({
          score: z.number(),
          verdict: z.string(),
          voice: z.string(),
          parts: z.object({ situation: part, task: part, action: part, result: part }),
          strengths: z.array(z.string()),
          gaps: z.array(z.string()),
        }),
      }),
      ...(providerOptions ? { providerOptions } : {}),
    });
    if (!output) throw new Error("empty");

    const fix = (p: { rating: string; note: string }) => ({
      rating: (RATINGS as readonly string[]).includes(p?.rating) ? p.rating : "ok",
      note: p?.note ?? "",
    });
    return NextResponse.json({
      score: Math.max(0, Math.min(100, Math.round(output.score))),
      verdict: output.verdict,
      voice: output.voice,
      parts: {
        situation: fix(output.parts.situation),
        task: fix(output.parts.task),
        action: fix(output.parts.action),
        result: fix(output.parts.result),
      },
      strengths: output.strengths.slice(0, 3),
      gaps: output.gaps.slice(0, 3),
    });
  } catch (e) {
    console.log(e);
    return NextResponse.json(
      { error: "Evaluation failed", detail: String(e), provider: await llmLabel().catch(() => "the LLM") },
      { status: 500 }
    );
  }
}
