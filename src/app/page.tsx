"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuArrowRight, LuSparkles } from "react-icons/lu";
import { useSessionStore, Seniority, InterviewStage, INTERVIEW_STAGES, jdKeyOf } from "@/store/useSessionStore";
import { STAGES } from "@/lib/interview";
import { requestQuestions, llmErrorMessage } from "@/lib/session";
import { LANGS, LANG_LEVEL, Lang, LangLevel, t } from "@/lib/i18n";
import PreferredQA from "@/components/PreferredQA";
import SentenceSelect, { SentenceText } from "@/components/SentenceSelect";
import DocSlot from "@/components/DocSlot";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import Waveform from "@/components/ui/Waveform";

/** The three practice types the sentence offers; each maps onto convType + mode in the store. */
type Practice = "interview" | "work" | "everyday";

const PRACTICE_OPTIONS = [
  { value: "interview" as Practice, icon: "🎯", label: "job interview", description: "Questions a hiring panel would actually ask" },
  { value: "work" as Practice, icon: "💼", label: "work conversation", description: "Stand-ups, reviews and everyday work talk" },
  { value: "everyday" as Practice, icon: "🌞", label: "everyday chat", description: "Everyday situations and small talk" },
];

const LEVEL_HINT: Record<LangLevel, string> = {
  a1: "Very simple sentences", a2: "Daily-life basics", b1: "Opinions and experiences",
  b2: "Detailed explanations", c1: "Nuanced, complex ideas", c2: "Near-native",
};

export default function Onboarding() {
  const router = useRouter();
  const {
    setOnboarding, setQuestions,
    resumeText, language, convType, mode, seniority, langLevel, situation,
    stage, jdText, storyBanks,
  } = useSessionStore();

  // Every setting writes straight to the persisted store so each flow keeps its state.
  const practice: Practice = convType === "general" ? "everyday" : mode === "interview" ? "interview" : "work";
  const setPractice = (p: Practice) =>
    setOnboarding(p === "everyday" ? { convType: "general" } : { convType: "workspace", mode: p === "interview" ? "interview" : "professional" });

  const interview = practice === "interview";
  const hasJD = jdText.trim().length >= 40;
  const bank = hasJD ? storyBanks[jdKeyOf(jdText)] : undefined;
  const approvedStories = bank?.responsibilities.reduce((n, r) => n + r.stories.filter((s) => s.approved).length, 0) ?? 0;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    // With a JD, interview prep starts with the Story Bank: key responsibilities
    // and STAR stories first, questions second.
    if (interview && hasJD) {
      router.push("/stories");
      return;
    }
    await generate();
  }

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const data = await requestQuestions();
      setOnboarding({ topic: data.topic });
      setQuestions(data.questions);
      router.push("/study");
    } catch (e) {
      setError(llmErrorMessage(e));
      setLoading(false);
    }
  }

  const languageWord = (
    <SentenceSelect
      label={t(language, "chooseLanguage")}
      value={language}
      onChange={(v: Lang) => setOnboarding({ language: v })}
      options={LANGS.map((l) => ({ value: l.code, label: l.label, icon: l.flag }))}
    />
  );
  const practiceWord = (
    <SentenceSelect label="Practice type" value={practice} onChange={setPractice} options={PRACTICE_OPTIONS} />
  );
  const seniorityWord = (
    <SentenceSelect
      label={t(language, "chooseSeniority")}
      value={seniority}
      onChange={(v: Seniority) => setOnboarding({ seniority: v })}
      options={(["junior", "mid", "senior"] as Seniority[]).map((s) => ({ value: s, label: s === "mid" ? "mid-level" : s }))}
    />
  );

  // Documents read like a one-line summary once added.
  const jdSummary = bank
    ? [bank.jobTitle, bank.company?.name].filter(Boolean).join(" · ") || "Story bank saved"
    : jdText.trim().split("\n").find((l) => l.trim())?.trim().slice(0, 80);
  const resumeSummary = resumeText.trim()
    ? resumeText.trim().split("\n").find((l) => l.trim())?.trim().slice(0, 60)
    : undefined;

  const cta = loading
    ? t(language, "generating")
    : interview && hasJD
      ? t(language, bank ? "openStoryBank" : "buildStoryBank")
      : t(language, "generate");

  return (
    <PageShell
      size="hero"
      eyebrow="Set up · 30 seconds"
      title={<>Speak it until it <em className="not-italic text-accent-text">sounds like you.</em></>}
      lead="Questions written for your level, answered out loud on camera with a read on pace, grammar and delivery. Nothing is recorded until you press start."
    >
      <Waveform className="mb-8" bars={44} />

      <Card pad="lg" className="space-y-6">
        {/* The whole set-up as one sentence; each highlighted word is a menu.
            The copy is English, so keep it LTR even when practising Farsi. */}
        <div dir="ltr" lang="en" className="text-xl font-medium leading-[2.2] sm:text-2xl sm:leading-[2.1]">
          {practice === "everyday" ? (
            <>
              I&apos;m preparing for an {practiceWord} in {languageWord} at{" "}
              <SentenceSelect
                label={t(language, "chooseLangLevel")}
                value={langLevel}
                onChange={(v: LangLevel) => setOnboarding({ langLevel: v })}
                options={(Object.entries(LANG_LEVEL) as [LangLevel, string][]).map(([value, label]) => ({
                  value, label, description: LEVEL_HINT[value],
                }))}
              />{" "}
              level, about{" "}
              <SentenceText
                label={t(language, "situation")}
                value={situation}
                placeholder="a situation of your choice"
                onChange={(v) => setOnboarding({ situation: v })}
              />
              .
            </>
          ) : practice === "interview" ? (
            <>
              I&apos;m preparing for a {practiceWord} in {languageWord}, as a {seniorityWord} candidate, for the{" "}
              <SentenceSelect
                label={t(language, "chooseStage")}
                value={stage}
                onChange={(v: InterviewStage) => setOnboarding({ stage: v })}
                options={INTERVIEW_STAGES.map((s) => ({
                  value: s, label: STAGES[s].label, icon: STAGES[s].icon, description: STAGES[s].description,
                }))}
              />{" "}
              round.
            </>
          ) : (
            <>I&apos;m preparing for a {practiceWord} in {languageWord}, as a {seniorityWord} professional.</>
          )}
        </div>

        {practice !== "everyday" && (
          <div className={`grid gap-3 ${interview ? "sm:grid-cols-2" : ""}`}>
            <DocSlot
              icon="📄"
              title="Résumé"
              hint="Optional — makes the questions about your experience"
              placeholder="Paste your résumé text…"
              text={resumeText}
              summary={resumeSummary}
              onText={(v) => setOnboarding({ resumeText: v })}
            />
            {interview && (
              <DocSlot
                icon="📋"
                title={t(language, "jobDescription")}
                hint="Unlocks key responsibilities and STAR stories"
                placeholder={t(language, "jobDescriptionPlaceholder")}
                text={jdText}
                minLength={40}
                summary={jdSummary}
                onText={(v) => setOnboarding({ jdText: v })}
              />
            )}
          </div>
        )}

        {interview && jdText.trim().length > 0 && !hasJD && (
          <p className="text-sm text-fg-muted">Paste the full posting — this looks too short to find the key responsibilities.</p>
        )}

        <PreferredQA tab={convType} language={language} />

        {error && <Alert tone="error" title="Couldn't build your session">{error}</Alert>}

        <div className="space-y-3 border-t border-line pt-6">
          <Button size="lg" fullWidth loading={loading} onClick={handleSubmit}>
            {!loading && <LuSparkles aria-hidden className="h-4 w-4" />}
            {cta}
          </Button>

          {interview && bank ? (
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-fg-muted">
              <span>
                <span className="font-medium text-accent-text">✓ {t(language, "storyBankSaved")}</span>
                {" "}· {bank.responsibilities.length} responsibilities · {approvedStories} stories
              </span>
              <button
                type="button"
                disabled={loading}
                onClick={generate}
                className="inline-flex items-center gap-1 font-semibold text-fg underline underline-offset-2 hover:text-accent-text"
              >
                {t(language, "skipToQuestions", { stage: STAGES[stage].short })}
                <LuArrowRight aria-hidden className="flip-rtl h-3.5 w-3.5" />
              </button>
            </p>
          ) : (
            <p className="text-center text-sm text-fg-muted">
              {interview && hasJD
                ? "First we pull the key responsibilities from the JD and draft STAR stories with you — then the questions."
                : interview
                  ? "Add a job description to get key responsibilities and STAR stories tailored to the role."
                  : "You'll review the questions first — nothing is recorded until you choose to start."}
            </p>
          )}
        </div>
      </Card>
    </PageShell>
  );
}
