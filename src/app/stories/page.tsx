"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuCheck, LuExternalLink, LuTriangleAlert, LuGauge, LuGlobe, LuPencil, LuRefreshCcw, LuSparkles, LuTrash2, LuWandSparkles, LuX,
} from "react-icons/lu";
import {
  useSessionStore, jdKeyOf, hashText, storyHashOf, INTERVIEW_STAGES, MIN_APPROVED_STORIES,
  type CompanyProfile, type InterviewStage, type PartRating, type Responsibility, type StarStory,
  type StoryBank, type StoryEvaluation, type StoryPrompt,
} from "@/store/useSessionStore";
import { STAGES, storyGaps, uid } from "@/lib/interview";
import { requestQuestions, llmErrorMessage } from "@/lib/session";
import { t, type Lang } from "@/lib/i18n";
import DictateButton from "@/components/DictateButton";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextArea, TextField } from "@/components/ui/Field";
import PageShell from "@/components/ui/PageShell";
import { SkeletonText } from "@/components/ui/Skeleton";

type Draft = { title: string; situation: string; task: string; action: string; result: string };

/** What the evaluator needs besides the story itself. */
interface EvalContext {
  stage: InterviewStage;
  company?: CompanyProfile;
  jobTitle: string;
  respTitles: string[];
  seniority: string;
  language: Lang;
}

export default function Stories() {
  const router = useRouter();
  const {
    jdText, resumeText, language, seniority, stage, storyBanks,
    setOnboarding, setStoryBank, updateResponsibility, setQuestions, setCompany,
  } = useSessionStore();

  const jdKey = jdKeyOf(jdText);
  const bank = jdKey ? storyBanks[jdKey] : undefined;

  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const started = useRef(false);

  async function build() {
    setBuilding(true);
    setBuildError("");
    try {
      const res = await fetch("/api/story-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, resumeText, language, seniority }),
      });
      const data = await res.json();
      if (!data.responsibilities?.length) {
        throw new Error([data.provider && `via ${data.provider}`, data.detail || "no responsibilities came back"].filter(Boolean).join(" — "));
      }
      const next: StoryBank = {
        jdKey,
        jobTitle: data.jobTitle || "",
        // Keep company research across a rebuild; otherwise prefill the name from the JD.
        company: bank?.company ?? { name: data.companyName || "", text: "", sources: [] },
        updatedAt: Date.now(),
        responsibilities: data.responsibilities.map(
          (r: { title: string; summary: string; stories: Draft[]; prompts: string[] }): Responsibility => ({
            id: uid(),
            title: r.title,
            summary: r.summary,
            stories: (r.stories ?? []).slice(0, 2).map((s) => ({ ...s, id: uid(), source: "ai", approved: true })),
            prompts: (r.prompts ?? []).slice(0, 3).map((p) => ({ id: uid(), prompt: p, answer: "" })),
          })
        ),
      };
      setStoryBank(next);
      setConfirmRebuild(false);
    } catch (e) {
      setBuildError(llmErrorMessage(e));
    } finally {
      setBuilding(false);
    }
  }

  useEffect(() => {
    if (!started.current && jdKey && !bank) {
      started.current = true;
      build();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jdKey]);

  async function generateQuestions() {
    setGenerating(true);
    setGenError("");
    try {
      const data = await requestQuestions();
      setOnboarding({ topic: data.topic });
      setQuestions(data.questions);
      router.push("/study");
    } catch (e) {
      setGenError(llmErrorMessage(e));
      setGenerating(false);
    }
  }

  if (!jdKey) {
    return (
      <PageShell title="No job description yet" lead="Paste a job description on the set-up page and we'll find the key responsibilities and draft STAR stories with you." backHref="/" backLabel="Set-up">
        <Button size="lg" onClick={() => router.push("/")}>Back to set-up</Button>
      </PageShell>
    );
  }

  const gaps = storyGaps(bank?.responsibilities, MIN_APPROVED_STORIES);
  const withOwn = (bank?.responsibilities.length ?? 0) - (bank?.responsibilities.filter((r) => !r.stories.some((s) => s.approved && s.source === "user")).length ?? 0);

  return (
    <PageShell
      eyebrow={`${t(language, "storyBank")}${bank?.jobTitle ? ` · ${bank.jobTitle}` : ""}`}
      title={t(language, "keyResponsibilities")}
      lead="What this role is really about, with two STAR stories for each responsibility. Edit them until they're true to you, then answer the prompts to add stories of your own — they make the strongest answers."
      backHref="/"
      backLabel="Set-up"
    >
      <div className="space-y-6">
        {building && !bank && (
          <Card pad="lg">
            <SkeletonText lines={8} label="Reading the job description and drafting your STAR stories…" />
            <p className="mt-4 text-sm text-fg-muted">This takes up to a minute — it&apos;s writing around a dozen stories.</p>
          </Card>
        )}

        {buildError && (
          <Alert tone="error" title="Couldn't build your story bank">
            {buildError}
            <div className="mt-3"><Button size="sm" onClick={build}>Try again</Button></div>
          </Alert>
        )}

        {bank && (
          <>
            <CompanyCard
              company={bank.company}
              jobTitle={bank.jobTitle}
              respTitles={bank.responsibilities.map((r) => r.title)}
              language={language}
              onChange={(d) => setCompany(jdKey, d)}
            />

            <Card pad="md" className="space-y-3">
              <p className="font-semibold">
                {withOwn} of {bank.responsibilities.length} responsibilities have a story of your own
              </p>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={bank.responsibilities.length}
                aria-valuenow={withOwn}
                aria-label="Responsibilities with your own story"
              >
                <div className="h-full bg-accent transition-all" style={{ width: `${(withOwn / bank.responsibilities.length) * 100}%` }} />
              </div>
              <ol className="flex flex-wrap gap-2">
                {bank.responsibilities.map((r, i) => {
                  const own = r.stories.some((s) => s.approved && s.source === "user");
                  return (
                    <li key={r.id}>
                      <a
                        href={`#resp-${r.id}`}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                          own ? "border-accent bg-accent-soft text-accent-text" : "border-line text-fg-muted hover:bg-surface-2"
                        }`}
                      >
                        {own && <LuCheck aria-hidden className="h-3 w-3" />}
                        {i + 1}. {r.title}
                      </a>
                    </li>
                  );
                })}
              </ol>
            </Card>

            {bank.responsibilities.map((r, i) => (
              <ResponsibilityCard
                key={r.id}
                index={i + 1}
                resp={r}
                language={language}
                seniority={seniority}
                ctx={{
                  stage, company: bank.company, jobTitle: bank.jobTitle, seniority, language,
                  respTitles: bank.responsibilities.map((x) => `${x.title} — ${x.summary}`),
                }}
                update={(fn) => updateResponsibility(jdKey, r.id, fn)}
              />
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={building}
                loading={building}
                onClick={() => (confirmRebuild ? build() : setConfirmRebuild(true))}
              >
                {!building && <LuRefreshCcw aria-hidden className="h-4 w-4" />}
                {confirmRebuild ? "Click again — this replaces every story, including yours" : "Rebuild from the job description"}
              </Button>
            </div>

            {genError && <Alert tone="error" title="Couldn't build your questions">{genError}</Alert>}

            {/* Slim sticky action bar: the stage is chosen in the tabs at the top. */}
            <div className="sticky bottom-4 z-10 flex items-center gap-2 rounded-2xl border border-line bg-surface/95 p-2 shadow-lg backdrop-blur sm:gap-3">
              <StageTabs
                value={stage}
                label={t(language, "chooseStage")}
                onChange={(s) => setOnboarding({ stage: s })}
              />
              {gaps.length > 0 ? (
                <a
                  href={`#resp-${gaps[0].r.id}`}
                  className="ms-auto flex min-w-0 items-center gap-1.5 text-sm text-warning hover:underline"
                  title="Responsibilities with no story of your own yet. You can still go ahead — the drafts will be used."
                >
                  <LuTriangleAlert aria-hidden className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {gaps.length}<span className="hidden sm:inline"> gap{gaps.length === 1 ? "" : "s"}</span>
                    <span className="sr-only"> — responsibilities without a story of your own</span>
                  </span>
                </a>
              ) : (
                <span className="ms-auto flex items-center gap-1.5 text-sm text-accent-text" title="Every responsibility has a story of your own">
                  <LuCheck aria-hidden className="h-4 w-4" /><span className="sr-only">All responsibilities covered</span>
                </span>
              )}
              <Button loading={generating} onClick={generateQuestions} aria-label={`Generate ${STAGES[stage].label} questions`}>
                {!generating && <LuSparkles aria-hidden className="h-4 w-4" />}
                {generating ? "Generating…" : "Generate"}
              </Button>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

/**
 * Compact stage switcher for the sticky bar. It is page-wide context: it
 * decides which questions get generated and which interviewer the Evaluate
 * buttons play. Segmented radio group on wider screens (one tab stop, arrow
 * keys move), a native select on phones where four segments don't fit.
 */
function StageTabs({
  value, label, onChange,
}: { value: InterviewStage; label: string; onChange: (s: InterviewStage) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const fwd = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    const delta = e.key === fwd || e.key === "ArrowDown" ? 1 : e.key === back || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + INTERVIEW_STAGES.length) % INTERVIEW_STAGES.length;
    onChange(INTERVIEW_STAGES[next]);
    refs.current[next]?.focus();
  }
  return (
    <>
      <label className="sm:hidden">
        <span className="sr-only">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as InterviewStage)}
          className="h-10 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-fg"
        >
          {INTERVIEW_STAGES.map((s) => (
            <option key={s} value={s}>{STAGES[s].icon} {STAGES[s].short}</option>
          ))}
        </select>
      </label>
      <div
        role="radiogroup"
        aria-label={label}
        className="hidden rounded-xl border border-line bg-surface-2 p-1 sm:inline-flex"
      >
        {INTERVIEW_STAGES.map((s, i) => {
          const on = s === value;
          return (
            <button
              key={s}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              title={`${STAGES[s].label} — ${STAGES[s].description}`}
              onClick={() => onChange(s)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`flex h-8 items-center rounded-lg px-3 text-sm font-semibold transition-colors duration-fast ${
                on ? "bg-accent text-accent-fg shadow-sm" : "text-fg-muted hover:bg-surface hover:text-fg"
              }`}
            >
              {STAGES[s].short}
            </button>
          );
        })}
      </div>
    </>
  );
}

function ResponsibilityCard({
  index, resp, language, seniority, ctx, update,
}: {
  index: number;
  resp: Responsibility;
  language: Lang;
  seniority: string;
  ctx: EvalContext;
  update: (fn: (r: Responsibility) => Responsibility) => void;
}) {
  const [hints, setHints] = useState<Record<string, string[]>>({});

  const setStory = (id: string, d: Partial<StarStory>) =>
    update((r) => ({ ...r, stories: r.stories.map((s) => (s.id === id ? { ...s, ...d } : s)) }));
  const removeStory = (id: string) =>
    update((r) => ({
      ...r,
      stories: r.stories.filter((s) => s.id !== id),
      prompts: r.prompts.map((p) => (p.storyId === id ? { ...p, storyId: undefined } : p)),
    }));
  const setPrompt = (id: string, d: Partial<StoryPrompt>) =>
    update((r) => ({ ...r, prompts: r.prompts.map((p) => (p.id === id ? { ...p, ...d } : p)) }));
  const addPrompt = () =>
    update((r) => ({ ...r, prompts: [...r.prompts, { id: uid(), prompt: `Another experience that shows: ${r.title}`, answer: "" }] }));

  function addStoryFromPrompt(p: StoryPrompt, story: Draft & { missing?: string[] }) {
    const id = uid();
    update((r) => ({
      ...r,
      stories: [
        ...r.stories.filter((s) => s.id !== p.storyId),
        { id, title: story.title, situation: story.situation, task: story.task, action: story.action, result: story.result, source: "user", approved: true },
      ],
      prompts: r.prompts.map((x) => (x.id === p.id ? { ...x, storyId: id } : x)),
    }));
    setHints((h) => ({ ...h, [id]: story.missing ?? [] }));
  }

  const ownCount = resp.stories.filter((s) => s.source === "user").length;

  return (
    <Card as="section" pad="lg" id={`resp-${resp.id}`} aria-labelledby={`resp-${resp.id}-h`} className="scroll-mt-24 space-y-6">
      <header>
        <p className="eyebrow">Responsibility {index}</p>
        <h2 id={`resp-${resp.id}-h`} className="mt-1 text-2xl font-medium">{resp.title}</h2>
        <p className="mt-2 text-fg-muted">{resp.summary}</p>
      </header>

      <div className="space-y-4">
        <h3 className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
          STAR stories · {resp.stories.filter((s) => s.approved).length} in use
        </h3>
        {resp.stories.length === 0 && <p className="text-sm text-fg-muted">No stories yet — answer a prompt below.</p>}
        <ul className="space-y-4">
          {resp.stories.map((s) => (
            <li key={s.id}>
              <StoryCard
                story={s}
                language={language}
                hints={hints[s.id]}
                ctx={ctx}
                responsibility={`${resp.title} — ${resp.summary}`}
                onChange={(d) => setStory(s.id, d)}
                onRemove={() => removeStory(s.id)}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4 border-t border-line pt-6">
        <div>
          <h3 className="font-semibold">{t(language, "moreStories")}</h3>
          <p className="mt-1 text-sm text-fg-muted">
            {ownCount === 0
              ? "Pick a prompt and jot down what happened — rough notes are fine, in any language. We'll shape it into STAR."
              : "Nice. Another one gives you a spare when an interviewer asks a follow-up."}
          </p>
        </div>
        <ul className="space-y-3">
          {resp.prompts.map((p) => (
            <li key={p.id}>
              <PromptItem
                prompt={p}
                language={language}
                seniority={seniority}
                responsibility={`${resp.title} — ${resp.summary}`}
                onChange={(d) => setPrompt(p.id, d)}
                onStory={(story) => addStoryFromPrompt(p, story)}
              />
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" onClick={addPrompt}>+ I have a different story for this</Button>
      </div>
    </Card>
  );
}


const PARTS = ["situation", "task", "action", "result"] as const;

const RATING_STYLE: Record<PartRating, string> = {
  strong: "bg-accent text-accent-fg",
  ok: "bg-surface-2 text-fg",
  weak: "bg-warning-soft text-warning",
  missing: "bg-danger-soft text-danger",
};

function isStale(ev: StoryEvaluation, story: StarStory, company?: CompanyProfile) {
  return ev.storyHash !== storyHashOf(story) || ev.companyHash !== hashText(company?.text ?? "");
}

function scoreTone(score: number) {
  return score >= 85 ? "text-accent-text" : score >= 60 ? "text-fg" : "text-danger";
}

function StoryCard({
  story, language, hints, ctx, responsibility, onChange, onRemove,
}: {
  story: StarStory;
  language: Lang;
  hints?: string[];
  ctx: EvalContext;
  responsibility: string;
  onChange: (d: Partial<StarStory>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(story);
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState("");
  const [shownStage, setShownStage] = useState<InterviewStage | null>(null);
  const parts = PARTS.map((k) => [k, t(language, `${k}Label` as "situationLabel")] as const);

  const evaluations = INTERVIEW_STAGES.map((s) => story.evaluations?.[s]).filter(Boolean) as StoryEvaluation[];
  const visibleStage = shownStage && story.evaluations?.[shownStage] ? shownStage
    : story.evaluations?.[ctx.stage] ? ctx.stage : evaluations[0]?.stage ?? null;
  const shown = visibleStage ? story.evaluations?.[visibleStage] : undefined;

  async function evaluate() {
    setEvaluating(true);
    setEvalError("");
    try {
      const res = await fetch("/api/evaluate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story, responsibility, responsibilities: ctx.respTitles, jobTitle: ctx.jobTitle,
          company: ctx.company, stage: ctx.stage, seniority: ctx.seniority, language: ctx.language,
        }),
      });
      const data = await res.json();
      if (typeof data.score !== "number") throw new Error(data.detail || "no evaluation came back");
      const ev: StoryEvaluation = {
        ...data,
        stage: ctx.stage,
        storyHash: storyHashOf(story),
        companyHash: hashText(ctx.company?.text ?? ""),
        createdAt: Date.now(),
      };
      onChange({ evaluations: { ...story.evaluations, [ctx.stage]: ev } });
      setShownStage(ctx.stage);
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : String(e));
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${story.approved ? "border-accent-text/30 bg-accent-soft" : "border-line bg-surface-2"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-block rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider ${
            story.source === "user" ? "bg-accent text-accent-fg" : "bg-surface text-fg-muted"
          }`}>
            {story.source === "user" ? "Your story" : "Draft from your résumé"}
          </span>
          {!editing && <h4 className="mt-2 font-semibold">{story.title}</h4>}
        </div>
        {!editing && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={story.approved ? "primary" : "secondary"}
              aria-pressed={story.approved}
              onClick={() => onChange({ approved: !story.approved })}
            >
              {story.approved && <LuCheck aria-hidden className="h-4 w-4" />}
              {story.approved ? t(language, "approved") : t(language, "approve")}
            </Button>
            <Button size="sm" variant="secondary" iconOnly aria-label="Edit story" onClick={() => { setDraft(story); setEditing(true); }}>
              <LuPencil aria-hidden className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" iconOnly aria-label="Delete story" onClick={onRemove}>
              <LuTrash2 aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <TextField label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          {parts.map(([k, label]) => (
            <TextArea key={k} label={label} rows={3} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
          ))}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onChange(draft); setEditing(false); }}>{t(language, "saveAnswer")}</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>{t(language, "cancel")}</Button>
          </div>
        </div>
      ) : (
        <dl className="mt-3 space-y-2">
          {parts.map(([k, label]) => (
            <div key={k} className="grid gap-1 sm:grid-cols-[6.5rem_1fr]">
              <dt className="text-2xs font-semibold uppercase tracking-wider text-accent-text">{label}</dt>
              <dd className="leading-relaxed">{story[k]}</dd>
            </div>
          ))}
        </dl>
      )}

      {!!hints?.length && !editing && (
        <Alert tone="info" className="mt-4" title="Make it stronger">
          <ul className="list-disc space-y-1 ps-5">{hints.map((h) => <li key={h}>{h}</li>)}</ul>
          <p className="mt-2 text-sm text-fg-muted">Add the details with the edit button, or answer the prompt again.</p>
        </Alert>
      )}

      {!editing && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" loading={evaluating} onClick={evaluate}>
              {!evaluating && <LuGauge aria-hidden className="h-4 w-4" />}
              {story.evaluations?.[ctx.stage] ? "Re-evaluate" : "Evaluate"} as {STAGES[ctx.stage].short}
            </Button>
            {!ctx.company?.text?.trim() && (
              <span className="text-xs text-fg-muted">Tip: add the company profile above for a sharper verdict.</span>
            )}
            {evaluations.length > 0 && (
              <div role="tablist" aria-label="Evaluations by stage" className="ms-auto flex flex-wrap gap-1.5">
                {evaluations.map((ev) => {
                  const stale = isStale(ev, story, ctx.company);
                  const on = ev.stage === visibleStage;
                  return (
                    <button
                      key={ev.stage}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setShownStage(ev.stage)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        on ? "border-accent bg-surface" : "border-line text-fg-muted hover:bg-surface"
                      } ${stale ? "opacity-70" : ""}`}
                    >
                      {STAGES[ev.stage].short} <span className={scoreTone(ev.score)}>{ev.score}</span>
                      {stale && <span className="sr-only"> (out of date)</span>}
                      {stale && <span aria-hidden> · old</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {evalError && <p role="alert" className="text-sm font-medium text-danger">{evalError}</p>}
          {shown && (
            <EvaluationPanel
              key={`${shown.stage}-${shown.createdAt}`}
              ev={shown}
              stale={isStale(shown, story, ctx.company)}
              story={story}
              ctx={ctx}
              responsibility={responsibility}
              evaluating={evaluating}
              onReevaluate={shown.stage === ctx.stage ? evaluate : undefined}
              onAccept={(d) => onChange(d)}
            />
          )}
        </div>
      )}
    </div>
  );
}

type ImproveState =
  | { step: "idle" }
  | { step: "loading"; label: string }
  | { step: "questions"; questions: string[]; answers: string[] }
  | { step: "proposal"; story: Draft; changes: string[] };

function EvaluationPanel({
  ev, stale, story, ctx, responsibility, evaluating, onReevaluate, onAccept,
}: {
  ev: StoryEvaluation;
  stale: boolean;
  story: StarStory;
  ctx: EvalContext;
  responsibility: string;
  evaluating: boolean;
  onReevaluate?: () => void;
  onAccept: (d: Draft) => void;
}) {
  const { language } = ctx;
  const [improve, setImprove] = useState<ImproveState>({ step: "idle" });
  const [error, setError] = useState("");
  const companyName = ctx.company?.name?.trim();

  const call = async (body: object) => {
    const res = await fetch("/api/improve-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story, evaluation: ev, responsibility, company: ctx.company, stage: ev.stage, language, ...body,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.detail || data.error);
    return data;
  };

  async function rewrite(questions: string[] = [], answers: string[] = []) {
    setImprove({ step: "loading", label: "Rewriting your story…" });
    try {
      const data = await call({ phase: "rewrite", answers: questions.map((q, i) => ({ question: q, answer: answers[i] ?? "" })) });
      setImprove({
        step: "proposal",
        story: { title: data.title, situation: data.situation, task: data.task, action: data.action, result: data.result },
        changes: data.changes ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setImprove({ step: "idle" });
    }
  }

  async function start() {
    setError("");
    setImprove({ step: "loading", label: "Checking which facts are missing…" });
    try {
      const data = await call({ phase: "questions" });
      const qs: string[] = data.questions ?? [];
      if (qs.length) setImprove({ step: "questions", questions: qs, answers: qs.map(() => "") });
      else await rewrite();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setImprove({ step: "idle" });
    }
  }

  return (
    <section
      aria-label={`${STAGES[ev.stage].label} evaluation`}
      className={`rounded-xl border border-line bg-surface p-4 sm:p-5 ${stale ? "opacity-90" : ""}`}
    >
      {stale && (
        <Alert tone="warning" live={false} className="mb-4" title="Out of date">
          The story or the company profile changed since this evaluation.
          {onReevaluate ? (
            <div className="mt-2">
              <Button size="sm" variant="secondary" loading={evaluating} onClick={onReevaluate}>Re-evaluate</Button>
            </div>
          ) : (
            <> Switch the stage in the bar at the bottom to {STAGES[ev.stage].short} to re-evaluate.</>
          )}
        </Alert>
      )}

      <div className="flex items-start gap-4">
        <div className="shrink-0 text-center">
          <p className={`text-4xl font-medium leading-none ${scoreTone(ev.score)}`}>{ev.score}</p>
          <p className="mt-1 text-2xs uppercase tracking-wider text-fg-muted">coverage</p>
        </div>
        <div className="min-w-0">
          <p className="eyebrow">{STAGES[ev.stage].icon} {STAGES[ev.stage].label}{companyName ? ` · ${companyName}` : ""}</p>
          <p className="mt-1 font-semibold">{ev.verdict}</p>
          {ev.voice && <blockquote className="mt-2 border-s-2 border-accent ps-3 text-sm italic text-fg-muted">{ev.voice}</blockquote>}
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {PARTS.map((k) => (
          <li key={k} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
                {t(language, `${k}Label` as "situationLabel")}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold uppercase ${RATING_STYLE[ev.parts[k].rating]}`}>
                {ev.parts[k].rating}
              </span>
            </div>
            <p className="mt-1 text-sm">{ev.parts[k].note}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h5 className="text-2xs font-semibold uppercase tracking-wider text-accent-text">What lands</h5>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">{ev.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div>
          <h5 className="text-2xs font-semibold uppercase tracking-wider text-danger">What&apos;s missing for them now</h5>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">{ev.gaps.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        {improve.step === "idle" && (
          <Button size="sm" onClick={start}>
            <LuWandSparkles aria-hidden className="h-4 w-4" />
            Improve story
          </Button>
        )}

        {improve.step === "loading" && <SkeletonText lines={3} label={improve.label} />}

        {improve.step === "questions" && (
          <div className="space-y-3">
            <p className="font-semibold">A few facts first — so the new version stays true to you</p>
            {improve.questions.map((q, i) => (
              <TextArea
                key={q}
                label={q}
                rows={2}
                value={improve.answers[i]}
                onChange={(e) => {
                  const answers = [...improve.answers];
                  answers[i] = e.target.value;
                  setImprove({ ...improve, answers });
                }}
              />
            ))}
            <p className="text-sm text-fg-muted">Leave one empty if you don&apos;t know — it will be left out, not guessed.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => rewrite(improve.questions, improve.answers)}>Rewrite the story</Button>
              <Button size="sm" variant="secondary" onClick={() => setImprove({ step: "idle" })}>{t(language, "cancel")}</Button>
            </div>
          </div>
        )}

        {improve.step === "proposal" && (
          <div className="space-y-4">
            <p className="font-semibold">Proposed version: {improve.story.title}</p>
            {!!improve.changes.length && (
              <ul className="list-disc space-y-1 ps-5 text-sm text-fg-muted">{improve.changes.map((c) => <li key={c}>{c}</li>)}</ul>
            )}
            <dl className="space-y-3">
              {PARTS.map((k) => (
                <div key={k} className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-2 p-3">
                    <dt className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
                      {t(language, `${k}Label` as "situationLabel")} · now
                    </dt>
                    <dd className="mt-1 text-sm text-fg-muted">{story[k]}</dd>
                  </div>
                  <div className="rounded-lg border border-accent-text/30 bg-accent-soft p-3">
                    <dt className="text-2xs font-semibold uppercase tracking-wider text-accent-text">
                      {t(language, `${k}Label` as "situationLabel")} · proposed
                    </dt>
                    <dd className="mt-1 text-sm">{improve.story[k]}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { onAccept(improve.story); setImprove({ step: "idle" }); }}>
                <LuCheck aria-hidden className="h-4 w-4" />
                Accept new version
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setImprove({ step: "idle" })}>
                <LuX aria-hidden className="h-4 w-4" />
                Keep mine
              </Button>
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-2 text-sm font-medium text-danger">{error}</p>}
      </div>
    </section>
  );
}

function CompanyCard({
  company, jobTitle, respTitles, language, onChange,
}: {
  company?: CompanyProfile;
  jobTitle: string;
  respTitles: string[];
  language: Lang;
  onChange: (d: Partial<CompanyProfile>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = company?.name ?? "";
  const text = company?.text ?? "";

  async function research() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/company-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: name, jobTitle, responsibilities: respTitles, language }),
      });
      const data = await res.json();
      if (!data.text) throw new Error(data.detail || data.error || "nothing came back");
      onChange({ text: data.text, sources: data.sources ?? [], researchedAt: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" pad="lg" aria-labelledby="company-h" className="space-y-4">
      <div>
        <p className="eyebrow">Company</p>
        <h2 id="company-h" className="mt-1 text-2xl font-medium">Where the company is right now</h2>
        <p className="mt-2 text-sm text-fg-muted">
          The interviewer uses this to judge your stories against what the company needs today — its stage,
          challenges, tech and values. Write it yourself, or search the web and edit the result.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <TextField
          label="Company name"
          className="min-w-[12rem] flex-1"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <Button variant="secondary" loading={busy} disabled={!name.trim()} onClick={research} className="h-12">
          {!busy && <LuGlobe aria-hidden className="h-4 w-4" />}
          {busy ? "Searching…" : text ? "Search again" : "Search the web"}
        </Button>
      </div>
      {text && !busy && (
        <p className="text-xs text-fg-muted">Searching again replaces the text below.</p>
      )}

      {busy ? (
        <SkeletonText lines={6} label="Searching the web and summarising what matters for this role…" />
      ) : (
        <TextArea
          label="Company profile"
          labelHidden
          rows={10}
          placeholder="What they do, where they are now (growth, scale, challenges, news), their tech, culture and values…"
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      )}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}

      {!!company?.sources?.length && (
        <details className="text-sm">
          <summary className="cursor-pointer text-fg-muted">
            {company.sources.length} sources
            {company.researchedAt && ` · searched ${new Date(company.researchedAt).toLocaleDateString()}`}
          </summary>
          <ul className="mt-2 space-y-1">
            {company.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-text underline">
                  {s.title || s.url}
                  <LuExternalLink aria-hidden className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function PromptItem({
  prompt, language, seniority, responsibility, onChange, onStory,
}: {
  prompt: StoryPrompt;
  language: Lang;
  seniority: string;
  responsibility: string;
  onChange: (d: Partial<StoryPrompt>) => void;
  onStory: (s: Draft & { missing?: string[] }) => void;
}) {
  const [open, setOpen] = useState(!!prompt.answer && !prompt.storyId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function convert() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/star-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsibility, prompt: prompt.prompt, answer: prompt.answer, language, seniority }),
      });
      const data = await res.json();
      if (!data.action) throw new Error(data.detail || "no story came back");
      onStory(data);
      setOpen(false);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 p-4 text-start hover:bg-surface-2"
      >
        <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
          prompt.storyId ? "border-accent bg-accent text-accent-fg" : "border-line-strong"
        }`}>
          {prompt.storyId ? "✓" : ""}
        </span>
        <span className="flex-1 font-medium">{prompt.prompt}</span>
        <span className="text-xs text-fg-muted">{prompt.storyId ? "Story added" : open ? "Close" : "Answer"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-4">
          <TextArea
            label="What happened?"
            hint="Where were you, what was at stake, what did you do, and how did it end? Numbers help."
            rows={5}
            value={prompt.answer}
            onChange={(e) => onChange({ answer: e.target.value })}
          />
          <div className="flex flex-wrap items-start gap-2">
            <DictateButton
              language={language}
              disabled={busy}
              onText={(txt) => onChange({ answer: prompt.answer ? `${prompt.answer} ${txt}` : txt })}
            />
            <Button size="sm" loading={busy} disabled={prompt.answer.trim().length < 20} onClick={convert}>
              {!busy && <LuWandSparkles aria-hidden className="h-4 w-4" />}
              {prompt.storyId ? "Rewrite the story" : t(language, "turnIntoStar")}
            </Button>
          </div>
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
