"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuSparkles } from "react-icons/lu";
import { useSessionStore, Mode, Seniority, Converstion, InterviewStage, INTERVIEW_STAGES, jdKeyOf } from "@/store/useSessionStore";
import { STAGES } from "@/lib/interview";
import { requestQuestions, llmErrorMessage } from "@/lib/session";
import { LANGS, LANG_LEVEL, Lang, LangLevel, t } from "@/lib/i18n";
import PreferredQA from "@/components/PreferredQA";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ChoiceGroup from "@/components/ui/ChoiceGroup";
import { TextArea, TextField } from "@/components/ui/Field";
import FileDrop from "@/components/ui/FileDrop";
import PageShell from "@/components/ui/PageShell";
import Waveform from "@/components/ui/Waveform";

export default function Onboarding() {
  const router = useRouter();
  const {
    setOnboarding, setQuestions,
    resumeText, language, convType, mode, seniority, langLevel, situation,
    stage, jdText, storyBanks,
  } = useSessionStore();

  // Every setting writes straight to the persisted store so each tab keeps its state
  const setResumeText = (resumeText: string) => setOnboarding({ resumeText });
  const setLanguage = (language: Lang) => setOnboarding({ language });
  const setConvType = (convType: Converstion) => setOnboarding({ convType });
  const setMode = (mode: Mode) => setOnboarding({ mode });
  const setSeniority = (seniority: Seniority) => setOnboarding({ seniority });
  const setLangLevel = (langLevel: LangLevel) => setOnboarding({ langLevel });
  const setSituation = (situation: string) => setOnboarding({ situation });
  const setStage = (stage: InterviewStage) => setOnboarding({ stage });
  const setJdText = (jdText: string) => setOnboarding({ jdText });

  const interview = convType === "workspace" && mode === "interview";
  const hasJD = jdText.trim().length >= 40;
  const bank = hasJD ? storyBanks[jdKeyOf(jdText)] : undefined;
  const approvedStories = bank?.responsibilities.reduce((n, r) => n + r.stories.filter((s) => s.approved).length, 0) ?? 0;

  const [jdFileName, setJdFileName] = useState("");
  const [jdParsing, setJdParsing] = useState(false);
  const [jdError, setJdError] = useState("");

  async function handleJdFile(file: File) {
    setJdFileName(file.name);
    setJdParsing(true);
    setJdError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (data.text) setJdText(data.text);
      else setJdError("We couldn't find any text in that PDF. Paste the job description instead.");
    } catch {
      setJdError("Reading that file failed. Paste the job description instead.");
    } finally {
      setJdParsing(false);
    }
  }

  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [resumeError, setResumeError] = useState("");

  async function handleFile(file: File) {
    setFileName(file.name);
    setParsing(true);
    setResumeError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (data.text) setResumeText(data.text);
      else setResumeError("We couldn't find any text in that PDF. If it's a scan, try a text-based version.");
    } catch {
      setResumeError("Reading that file failed. Try again, or continue without a résumé.");
    } finally {
      setParsing(false);
    }
  }

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

  return (
    <PageShell
      size="hero"
      eyebrow="Set up · 30 seconds"
      title={<>Speak it until it <em className="not-italic text-accent-text">sounds like you.</em></>}
      lead="Questions written for your level, answered out loud on camera — with a read on pace, grammar and delivery. Nothing is recorded until you press start."
    >
      <Waveform className="mb-10" bars={44} />

      <Card pad="lg" className="space-y-8">
        <ChoiceGroup
          legend={t(language, "chooseConv")}
          value={convType}
          onChange={setConvType}
          columns={2}
          options={[
            {
              value: "workspace" as Converstion,
              label: t(language, "workspace"),
              icon: "💼",
              description: "Interviews and professional conversation",
            },
            {
              value: "general" as Converstion,
              label: t(language, "general"),
              icon: "🌞",
              description: "Everyday situations and small talk",
            },
          ]}
        />

        <PreferredQA tab={convType} language={language} />

        <ChoiceGroup
          legend={t(language, "chooseLanguage")}
          variant="tile"
          columns={5}
          value={language}
          onChange={setLanguage}
          options={LANGS.map((l) => ({ value: l.code, label: l.label, icon: l.flag }))}
        />

        {convType === "workspace" && (
          <>
            <FileDrop
              label={t(language, "uploadResume")}
              hint="Optional — it makes the questions specific to your experience."
              fileName={fileName}
              busy={parsing}
              busyLabel="Reading your PDF…"
              error={resumeError}
              status={resumeText ? `Résumé read — ${resumeText.length.toLocaleString()} characters extracted.` : undefined}
              onFile={handleFile}
            />

            <ChoiceGroup
              legend={t(language, "chooseMode")}
              value={mode}
              onChange={setMode}
              columns={2}
              options={[
                {
                  value: "interview" as Mode,
                  label: t(language, "interview"),
                  icon: "🎯",
                  description: "Questions a hiring panel would actually ask",
                },
                {
                  value: "professional" as Mode,
                  label: t(language, "professional"),
                  icon: "💼",
                  description: "Stand-ups, reviews and everyday work talk",
                },
              ]}
            />

            {mode === "interview" && (
              <>
                <ChoiceGroup
                  legend={t(language, "chooseStage")}
                  hint={t(language, "chooseStageHint")}
                  value={stage}
                  onChange={setStage}
                  columns={2}
                  options={INTERVIEW_STAGES.map((s) => ({
                    value: s,
                    label: `${STAGES[s].label} · ${STAGES[s].short}`,
                    icon: STAGES[s].icon,
                    description: STAGES[s].description,
                  }))}
                />

                <div className="space-y-3">
                  <TextArea
                    label={t(language, "jobDescription")}
                    hint={t(language, "jobDescriptionHint")}
                    placeholder={t(language, "jobDescriptionPlaceholder")}
                    rows={6}
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                  />
                  <FileDrop
                    label={t(language, "uploadJD")}
                    fileName={jdFileName}
                    busy={jdParsing}
                    busyLabel="Reading the job description…"
                    error={jdError}
                    status={jdFileName && jdText ? `Job description read — ${jdText.length.toLocaleString()} characters.` : undefined}
                    onFile={handleJdFile}
                  />
                  {bank && (
                    <Alert tone="success" live={false} title={t(language, "storyBankSaved")}>
                      {bank.responsibilities.length} key responsibilities · {approvedStories} approved STAR stories for
                      {" "}{bank.jobTitle || "this role"}. They&apos;ll be reused for every stage.
                    </Alert>
                  )}
                  {!hasJD && jdText.trim().length > 0 && (
                    <p className="text-sm text-fg-muted">Paste the full posting — this looks too short to find the key responsibilities.</p>
                  )}
                </div>
              </>
            )}

            <ChoiceGroup
              legend={t(language, "chooseSeniority")}
              variant="compact"
              columns={3}
              value={seniority}
              onChange={setSeniority}
              options={(["junior", "mid", "senior"] as Seniority[]).map((s) => ({
                value: s,
                label: t(language, s),
              }))}
            />
          </>
        )}

        {convType === "general" && (
          <>
            <ChoiceGroup
              legend={t(language, "chooseLangLevel")}
              hint="The CEFR level you want the questions pitched at."
              variant="compact"
              columns={6}
              value={langLevel}
              onChange={setLangLevel}
              options={(Object.entries(LANG_LEVEL) as [LangLevel, string][]).map(([value, label]) => ({
                value,
                label,
              }))}
            />

            <TextField
              label={t(language, "situation")}
              hint="The more specific you are, the better the questions."
              placeholder={t(language, "situationPlaceholder")}
              value={situation}
              onChange={(event) => setSituation(event.target.value)}
            />
          </>
        )}

        {error && <Alert tone="error" title="Couldn't build your session">{error}</Alert>}

        <div className="space-y-3 border-t border-line pt-6">
          <Button
            size="lg"
            fullWidth
            loading={loading}
            disabled={parsing || jdParsing}
            onClick={handleSubmit}
          >
            {!loading && <LuSparkles aria-hidden className="h-4 w-4" />}
            {loading
              ? t(language, "generating")
              : interview && hasJD
                ? t(language, bank ? "openStoryBank" : "buildStoryBank")
                : t(language, "generate")}
          </Button>
          {interview && hasJD && bank && (
            <Button
              variant="secondary"
              fullWidth
              disabled={loading || parsing || jdParsing}
              onClick={generate}
            >
              {t(language, "skipToQuestions", { stage: STAGES[stage].label })}
            </Button>
          )}
          <p className="text-center text-sm text-fg-muted">
            {interview && hasJD
              ? "First we pull the key responsibilities from the JD and draft STAR stories with you — then the questions."
              : interview
                ? "Add a job description to get key responsibilities and STAR stories tailored to the role."
                : "You'll review the questions first — nothing is recorded until you choose to start."}
          </p>
        </div>
      </Card>
    </PageShell>
  );
}
