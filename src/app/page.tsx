"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuSparkles } from "react-icons/lu";
import { useSessionStore, Mode, Seniority, Converstion } from "@/store/useSessionStore";
import { LANGS, LANG_LEVEL, Lang, LangLevel, t } from "@/lib/i18n";
import PreferredQA from "@/components/PreferredQA";
import { APP_MODE } from "@/lib/config";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ChoiceGroup from "@/components/ui/ChoiceGroup";
import { TextField } from "@/components/ui/Field";
import FileDrop from "@/components/ui/FileDrop";
import PageShell from "@/components/ui/PageShell";
import Waveform from "@/components/ui/Waveform";

export default function Onboarding() {
  const router = useRouter();
  const {
    setOnboarding, setQuestions, preferredQA,
    resumeText, language, convType, mode, seniority, langLevel, situation,
  } = useSessionStore();

  // Every setting writes straight to the persisted store so each tab keeps its state
  const setResumeText = (resumeText: string) => setOnboarding({ resumeText });
  const setLanguage = (language: Lang) => setOnboarding({ language });
  const setConvType = (convType: Converstion) => setOnboarding({ convType });
  const setMode = (mode: Mode) => setOnboarding({ mode });
  const setSeniority = (seniority: Seniority) => setOnboarding({ seniority });
  const setLangLevel = (langLevel: LangLevel) => setOnboarding({ langLevel });
  const setSituation = (situation: string) => setOnboarding({ situation });

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
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          convType, langLevel, resumeText, mode, seniority, language, situation,
          preferredQA: preferredQA[convType] ?? [],
        }),
      });
      const data = await res.json();
      if (!data.questions?.length) {
        // The route reports which backend it was talking to, so the message can
        // name the thing to go start instead of guessing.
        throw new Error(
          [data.provider && `via ${data.provider}`, data.detail || "no questions came back"]
            .filter(Boolean)
            .join(" — ")
        );
      }
      setOnboarding({ resumeText, language, mode, seniority, convType, langLevel, situation, topic: data.topic });
      setQuestions(data.questions);
      router.push("/study");
    } catch (e) {
      setError(
        APP_MODE === "local"
          ? `We couldn't reach your local model. Is Ollama running? Start it with \`ollama serve\`. (${String(e)})`
          : `We couldn't build your session. Check your OpenRouter key and your connection, then try again. (${String(e)})`
      );
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
            disabled={parsing}
            onClick={handleSubmit}
          >
            {!loading && <LuSparkles aria-hidden className="h-4 w-4" />}
            {loading ? t(language, "generating") : t(language, "generate")}
          </Button>
          <p className="text-center text-sm text-fg-muted">
            You&apos;ll review the questions first — nothing is recorded until you choose to start.
          </p>
        </div>
      </Card>
    </PageShell>
  );
}
