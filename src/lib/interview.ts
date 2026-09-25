// Interview-loop stages and the prompt building blocks shared by the
// question/answer/story routes. Safe to import on the client (no secrets).

import type { InterviewStage, QuestionKind, Responsibility, StarParts } from "@/store/useSessionStore";

export interface StageMeta {
  label: string;
  short: string;
  icon: string;
  /** One line for the set-up card. */
  description: string;
  /** Who is interviewing — goes into the prompt persona. */
  interviewer: string;
  /** What this round is trying to find out. */
  focus: string[];
  /** How many of each kind of question to generate (sums to 10). */
  mix: Partial<Record<QuestionKind, number>>;
}

export const STAGES: Record<InterviewStage, StageMeta> = {
  ta: {
    label: "Talent Acquisition",
    short: "TA",
    icon: "📞",
    description: "Recruiter screen — your story, motivation, logistics and fit",
    interviewer: "a Talent Acquisition partner (recruiter) running the first screening call",
    focus: [
      "the candidate's career story and why they are looking now",
      "motivation for this company and this role",
      "a high-level fit check against the key responsibilities of the role",
      "logistics: notice period, salary expectations, location / relocation, work model, work permit",
      "communication clarity and genuine interest",
    ],
    mix: { factual: 4, behavioural: 4, technical: 2 },
  },
  hrm: {
    label: "HR Manager",
    short: "HRM",
    icon: "🤝",
    description: "Values, culture fit, conflict, feedback and growth",
    interviewer: "an HR Manager assessing values, culture fit and behaviour",
    focus: [
      "alignment with company values and culture",
      "handling conflict, disagreement and difficult conversations",
      "giving and receiving feedback, learning from failure",
      "teamwork, adaptability under change and pressure",
      "career goals, growth and reasons for leaving",
    ],
    mix: { behavioural: 8, factual: 2 },
  },
  enm: {
    label: "Engineering Manager",
    short: "ENM",
    icon: "🧭",
    description: "Ownership, delivery, prioritisation and collaboration",
    interviewer: "the Engineering Manager who would be the candidate's line manager",
    focus: [
      "ownership and delivery of the key responsibilities of this role",
      "prioritisation, trade-offs and managing scope and deadlines",
      "stakeholder management and cross-team collaboration",
      "incidents, production issues and learning from mistakes",
      "mentoring, raising the bar and influencing without authority",
      "ways of working: agile process, planning, estimation",
    ],
    mix: { behavioural: 8, technical: 2 },
  },
  senior: {
    label: "Senior Engineer",
    short: "Senior Eng",
    icon: "🛠️",
    description: "Technical deep-dive, system design and tech-leadership stories",
    interviewer: "a Senior / Staff Engineer on the team running the technical round",
    focus: [
      "technical deep-dive into systems the candidate built, their architecture and trade-offs, using the tech stack in the JD",
      "spoken system-design questions grounded in the product and scale implied by the JD",
      "technical-leadership behaviour: code quality, reviews, incidents, mentoring, technical disagreements",
    ],
    mix: { technical: 3, "system-design": 3, behavioural: 4 },
  },
};

export const KIND_LABEL: Record<QuestionKind, string> = {
  behavioural: "Behavioural · STAR",
  technical: "Technical deep-dive",
  "system-design": "System design",
  factual: "Quick answer",
};

/** How the ideal answer for each kind should be written. */
export const KIND_RULES: Record<QuestionKind, string> = {
  behavioural:
    "Full STAR answer. Fill star.situation, star.task, star.action and star.result with 1-3 spoken sentences each; the Action is the longest and uses 'I', the Result is concrete and measurable where the source allows. idealAnswer is the four parts joined as natural speech, with no labels.",
  technical:
    "4-6 spoken sentences: name the concrete system or technology, how it works, the key decision and the trade-off considered, and the outcome. star fields are empty strings.",
  "system-design":
    "6-9 spoken sentences in this order: clarify requirements and scale, high-level components, data model and storage, the main bottleneck and how to scale it, reliability, and the key trade-off. star fields are empty strings.",
  factual:
    "1-3 short, confident spoken sentences. star fields are empty strings.",
};

export const SPOKEN_RULES = `Every question and idealAnswer is plain spoken text: no emojis, bullet points, quotation marks, parentheses, brackets, placeholders, labels, markdown or special symbols that would not normally be said out loud.`;

export function mixText(stage: InterviewStage, total: number): string {
  const mix = STAGES[stage].mix;
  const entries = Object.entries(mix) as [QuestionKind, number][];
  const sum = entries.reduce((a, [, n]) => a + n, 0);
  // Scale the default 10-question mix to however many are left after preferred Q&As.
  let left = total;
  const scaled = entries.map(([k, n], i) => {
    const v = i === entries.length - 1 ? left : Math.round((n / sum) * total);
    left -= v;
    return [k, Math.max(0, v)] as const;
  });
  return scaled.filter(([, n]) => n > 0).map(([k, n]) => `${n} x "${k}"`).join(", ");
}

/** Render the story bank for a prompt — approved stories only, the learner's own first. */
export function storyBankBlock(responsibilities: Responsibility[] | undefined): string {
  if (!responsibilities?.length) return "";
  const lines = responsibilities.map((r, i) => {
    const stories = [...r.stories]
      .filter((s) => s.approved)
      .sort((a, b) => (a.source === b.source ? 0 : a.source === "user" ? -1 : 1));
    const body = stories.length
      ? stories
          .map(
            (s) =>
              `   - [${s.source === "user" ? "candidate's own story" : "draft from résumé"}] ${s.title}\n` +
              `     S: ${s.situation}\n     T: ${s.task}\n     A: ${s.action}\n     R: ${s.result}`
          )
          .join("\n")
      : "   - (no approved story yet)";
    return `${i + 1}. ${r.title} — ${r.summary}\n${body}`;
  });
  return lines.join("\n");
}

export function joinStar(p: StarParts): string {
  return [p.situation, p.task, p.action, p.result].map((x) => x.trim()).filter(Boolean).join(" ");
}

export function hasStar(p?: StarParts | null): p is StarParts {
  return !!p && [p.situation, p.task, p.action, p.result].every((x) => typeof x === "string" && x.trim().length > 0);
}

/** Responsibilities that still need more approved stories. */
export function storyGaps(responsibilities: Responsibility[] | undefined, min: number) {
  return (responsibilities ?? [])
    .map((r) => ({ r, approved: r.stories.filter((s) => s.approved).length, own: r.stories.filter((s) => s.approved && s.source === "user").length }))
    .filter((x) => x.approved < min || x.own === 0);
}

export const uid = () => Math.random().toString(36).slice(2, 10);
