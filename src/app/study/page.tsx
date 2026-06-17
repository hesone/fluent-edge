"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { isRTL, t } from "@/lib/i18n";
import Stepper from "@/components/Stepper";
import { LuRefreshCcw } from "react-icons/lu";

export default function Study() {
  const router = useRouter();
  const { questions, resumeText, language, topic, setAnswerForQuestion } = useSessionStore();
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const rtl = isRTL(language);

  useEffect(() => {
    if(!loading && !!answer) {
      setAnswerForQuestion(q.id, answer)
      setAnswer("")
    }
  },[loading, answer])

  if (!questions.length) {
    return <Empty onBack={() => router.push("/")} />;
  }

  const q = questions[idx];

  const ask = async () => {
    setLoading(true);
    setAnswer('');

    const response = await fetch('/api/generate-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: q?.question,
        topic,
        resume: resumeText
      }),
    });
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      setAnswer(prev => prev + chunk);
    }
    setLoading(false);
  };
  
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

          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 min-h-44">
            <div className="flex justify-between items-end pb-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                {t(language, "idealAnswer")}
              </div>
              <button disabled={loading} className="p-2 rounded border border-slate-800 bg-slate-900/50 text-sm" onClick={ask}>
                <LuRefreshCcw className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            {!answer ?
              (loading ? 
                new Array(20).fill(0).map(() => <span style={{ width: `${Math.random() * (100 - 50) + 50}px` }} className="inline-block h-5 rounded bg-brand-500/20 animate-pulse mr-2 mb-1" /> ) :
                <p className="text-lg leading-relaxed text-slate-200">{q.idealAnswer}</p>
              ) :
              <p className="text-lg leading-relaxed text-slate-200">{answer}</p>
            }
          </div>

          <button onClick={proceed}
            disabled={loading}
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