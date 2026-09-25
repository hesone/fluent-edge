"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LuCheck, LuPencil, LuRefreshCcw, LuSparkles, LuTrash2, LuWandSparkles } from "react-icons/lu";
import {
  useSessionStore, jdKeyOf, INTERVIEW_STAGES, MIN_APPROVED_STORIES,
  type InterviewStage, type Responsibility, type StarStory, type StoryBank, type StoryPrompt,
} from "@/store/useSessionStore";
import { STAGES, storyGaps, uid } from "@/lib/interview";
import { requestQuestions, llmErrorMessage } from "@/lib/session";
import { t, type Lang } from "@/lib/i18n";
import DictateButton from "@/components/DictateButton";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ChoiceGroup from "@/components/ui/ChoiceGroup";
import { TextArea, TextField } from "@/components/ui/Field";
import PageShell from "@/components/ui/PageShell";
import { SkeletonText } from "@/components/ui/Skeleton";

type Draft = { title: string; situation: string; task: string; action: string; result: string };

export default function Stories() {
  const router = useRouter();
  const {
    jdText, resumeText, language, seniority, stage, storyBanks,
    setOnboarding, setStoryBank, updateResponsibility, setQuestions,
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

            <Card pad="lg" tone="accent" className="sticky bottom-4 space-y-5 shadow-lg">
              <ChoiceGroup
                legend={t(language, "chooseStage")}
                variant="compact"
                columns={2}
                value={stage}
                onChange={(s: InterviewStage) => setOnboarding({ stage: s })}
                options={INTERVIEW_STAGES.map((s) => ({ value: s, label: `${STAGES[s].icon} ${STAGES[s].short}` }))}
              />
              {gaps.length > 0 && (
                <p className="text-sm text-fg-muted">
                  {gaps.length} responsibilit{gaps.length === 1 ? "y has" : "ies have"} no story of your own yet. You can go ahead —
                  the drafts will be used — but your own stories make better answers.
                </p>
              )}
              {genError && <Alert tone="error" title="Couldn't build your questions">{genError}</Alert>}
              <Button size="lg" fullWidth loading={generating} onClick={generateQuestions}>
                {!generating && <LuSparkles aria-hidden className="h-4 w-4" />}
                {generating ? t(language, "generating") : t(language, "generateStageQuestions", { stage: STAGES[stage].label })}
              </Button>
            </Card>
          </>
        )}
      </div>
    </PageShell>
  );
}

function ResponsibilityCard({
  index, resp, language, seniority, update,
}: {
  index: number;
  resp: Responsibility;
  language: Lang;
  seniority: string;
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

function StoryCard({
  story, language, hints, onChange, onRemove,
}: {
  story: StarStory;
  language: Lang;
  hints?: string[];
  onChange: (d: Partial<StarStory>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(story);
  const parts = [
    ["situation", t(language, "situationLabel")],
    ["task", t(language, "taskLabel")],
    ["action", t(language, "actionLabel")],
    ["result", t(language, "resultLabel")],
  ] as const;

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
    </div>
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
