"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { isRTL, t } from "@/lib/i18n";
import Stepper from "@/components/Stepper";

export default function Study() {
  const router = useRouter();
  const { questions, language } = useSessionStore();
  const [idx, setIdx] = useState(0);
  const rtl = isRTL(language);

  if (!questions.length) {
    return <Empty onBack={() => router.push("/")} />;
  }

  const q = questions[idx];

  function proceed() {
    if (idx < questions.length - 1) setIdx(idx + 1);
    else {
      router.push("/practice/0");
    }
  }

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <Stepper current={idx} total={questions.length} />

        <div className="animate-fade-in rounded-3xl border border-slate-800 bg-slate-900/50 p-8">
          <div className="mb-2 text-sm font-medium uppercase tracking-wider text-brand-400">
            Study Mode
          </div>
          <h2 className="text-2xl font-bold">{q.question}</h2>

          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              {t(language, "idealAnswer")}
            </div>
            <p className="text-lg leading-relaxed text-slate-200">{q.idealAnswer}</p>
          </div>

          <button onClick={proceed}
            className="mt-8 w-full rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 py-4 font-semibold transition hover:brightness-110">
            {idx < questions.length - 1 ? t(language, "readyToPractice") : t(language, "startSession")}
          </button>
        </div>

        <div className="flex justify-center gap-1.5">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${i === idx ? "w-8 bg-brand-500" : "w-2 bg-slate-700"}`} />
          ))}
        </div>
      </div>
    </main>
  );
}

function Empty({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-slate-400">No session found.</p>
      <button onClick={onBack} className="rounded-xl bg-brand-600 px-6 py-3">Start over</button>
    </div>
  );
}