import { Mode } from "@/store/useSessionStore";
import { streamText } from "ai";
import { llm } from "@/lib/llm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const { question, topic, resume } = await req.json();
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
    const result = streamText({
      model: llm,
      prompt: prompt
    });

    if (!result.text) throw new Error("empty");
    
    return result.toTextStreamResponse()
  } catch (e) {
    console.log(e)
    return NextResponse.json({ error: "Generation failed", detail: String(e) }, { status: 500 });
  }
}