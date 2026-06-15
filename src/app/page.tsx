"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore, Mode, Seniority, Converstion } from "@/store/useSessionStore";
import { LANGS, LANG_LEVEL, Lang, LangLevel, isRTL, t } from "@/lib/i18n";

export default function Onboarding() {
  const router = useRouter();
  const { setOnboarding, setQuestions } = useSessionStore();

  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [language, setLanguage] = useState<Lang>("en");
  const [convType, setConvType] = useState<Converstion>("workspace");
  const [mode, setMode] = useState<Mode>("interview");
  const [seniority, setSeniority] = useState<Seniority>("mid");
  const [langLevel, setLangLevel] = useState<LangLevel>("c1");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");

  const rtl = isRTL(language);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setParsing(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (data.text) setResumeText(data.text);
      else setError("Could not read PDF text.");
    } catch {
      setError("Resume parsing failed.");
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    setOnboarding({ resumeText, language, mode, seniority, convType, langLevel });
    try {
      const res = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convType, langLevel, resumeText, mode, seniority, language }),
      });
      const data = await res.json();
      if (!data.questions?.length) throw new Error(data.detail || "no questions");
      setQuestions(data.questions);
      router.push("/study");
    } catch (e) {
      setError("Failed to generate questions. Is Ollama running? " + String(e));
      setLoading(false);
    }
  }

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-screen bg-gradient-to-br from-slate-950 via-brand-900/20 to-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <header className="mb-10 text-center animate-fade-in">
          <h1 className="bg-gradient-to-r from-brand-400 to-emerald-400 bg-clip-text text-5xl font-extrabold text-transparent">
            FluentEdge
          </h1>
          <p className="mt-2 text-slate-400">{t(language, "tagline")}</p>
        </header>

        <div className="space-y-8 rounded-3xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur">

          {/* Conversation Type */}
          <section>
            <label className="mb-2 block font-semibold">{t(language, "chooseConv")}</label>
            <div className="grid grid-cols-2 gap-3">
              {([["workspace", "💼", t(language, "workspace")], ["general", "🌞", t(language, "general")]] as const)
                .map(([m, icon, label]) => (
                <button key={m} onClick={() => setConvType(m as Converstion)}
                  className={`rounded-xl border px-4 py-4 text-start transition ${
                    convType === m ? "border-brand-500 bg-brand-500/20" : "border-slate-700 hover:border-slate-600"
                  }`}>
                  <div className="text-2xl">{icon}</div>
                  <div className="mt-1 font-medium">{label}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Language */}
          <section>
            <label className="mb-2 block font-semibold">{t(language, "chooseLanguage")}</label>
            <div className="grid grid-cols-5 gap-2">
              {LANGS.map((l) => (
                <button key={l.code} onClick={() => setLanguage(l.code)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition ${
                    language === l.code ? "border-brand-500 bg-brand-500/20" : "border-slate-700 hover:border-slate-600"
                  }`}>
                  <span className="text-2xl">{l.flag}</span>
                  <span className="text-xs">{l.label}</span>
                </button>
              ))}
            </div>
          </section>

          {convType === 'workspace' &&
            <>
              {/* Resume */}
              <section>
                <label className="mb-2 block font-semibold">{t(language, "uploadResume")}</label>
                <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/40 px-6 py-8 transition hover:border-brand-500">
                  <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
                  <span className="text-3xl">📄</span>
                  <span className="text-slate-300">
                    {parsing ? "Reading PDF…" : fileName || "Click to upload PDF"}
                  </span>
                </label>
                {resumeText && <p className="mt-2 text-xs text-emerald-400">✓ Extracted {resumeText.length} chars</p>}
              </section>

              {/* Mode */}
              <section>
                <label className="mb-2 block font-semibold">{t(language, "chooseMode")}</label>
                <div className="grid grid-cols-2 gap-3">
                  {([["interview", "🎯", t(language, "interview")], ["professional", "💼", t(language, "professional")]] as const)
                    .map(([m, icon, label]) => (
                    <button key={m} onClick={() => setMode(m as Mode)}
                      className={`rounded-xl border px-4 py-4 text-start transition ${
                        mode === m ? "border-brand-500 bg-brand-500/20" : "border-slate-700 hover:border-slate-600"
                      }`}>
                      <div className="text-2xl">{icon}</div>
                      <div className="mt-1 font-medium">{label}</div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Seniority */}
              <section>
                <label className="mb-2 block font-semibold">{t(language, "chooseSeniority")}</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["junior", "mid", "senior"] as Seniority[]).map((s) => (
                    <button key={s} onClick={() => setSeniority(s)}
                      className={`rounded-xl border px-4 py-3 capitalize transition ${
                        seniority === s ? "border-brand-500 bg-brand-500/20" : "border-slate-700 hover:border-slate-600"
                      }`}>
                      {t(language, s)}
                    </button>
                  ))}
                </div>
              </section>
            </>
          }

          {convType === 'general' &&
            <>
              {/* Seniority */}
              <section>
                <label className="mb-2 block font-semibold">{t(language, "chooseLangLevel")}</label>
                <div className="grid grid-cols-6 gap-3">
                  {(Object.entries(LANG_LEVEL) as [LangLevel, string][]).map(([key, value]) =>
                    <button key={key} onClick={() => setLangLevel(key)}
                      className={`rounded-xl border px-2 py-3 capitalize transition ${
                        langLevel === key ? "border-brand-500 bg-brand-500/20" : "border-slate-700 hover:border-slate-600"
                      }`}>
                      {value}
                    </button>
                  )}
                </div>
              </section>
            </>
          }

          {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading || parsing}
            className="w-full rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 py-4 font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? t(language, "generating") : t(language, "generate")}
          </button>
        </div>
      </div>
    </main>
  );
}