"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { isRTL, t } from "@/lib/i18n";
import { fireCardConfetti, FullPageConfetti } from "@/components/Confetti";

export default function Results() {
  const router = useRouter();
  const { questions, results, language, reset } = useSessionStore();
  const rtl = isRTL(language);
  const [replay, setReplay] = useState<number | null>(null);

  const allPerfect = useMemo(
    () => questions.length > 0 && questions.every((q) => {
      const r = results[q.id];
      return r && r.faceScore === 100 && r.grammarScore === 100;
    }),
    [questions, results]
  );

  if (!questions.length) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-slate-400">No results yet.</p>
        <button onClick={() => router.push("/")} className="rounded-xl bg-brand-600 px-6 py-3">Start</button>
      </div>
    );
  }

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-screen px-4 py-10">
      {allPerfect && <FullPageConfetti />}
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="text-center">
          <h1 className="bg-gradient-to-r from-brand-400 to-emerald-400 bg-clip-text text-4xl font-extrabold text-transparent">
            {t(language, "yourScores")}
          </h1>
          {allPerfect && (
            <p className="mt-3 animate-pop text-xl font-semibold text-emerald-400">
              🏆 {t(language, "allPerfect")}
            </p>
          )}
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {questions.map((q) => {
            const r = results[q.id];
            return (
              <ResultCard
                key={q.id}
                index={q.id}
                question={q.question}
                result={r}
                language={language}
                onReplay={() => setReplay(q.id)}
                onPracticeAgain={() => {
                  router.push("/practice/" + questions.findIndex((x) => x.id === q.id));
                }}
              />
            );
          })}
        </div>

        <button onClick={() => { reset(); router.push("/"); }}
          className="mx-auto block rounded-xl border border-slate-700 px-6 py-3 text-slate-300 hover:bg-slate-800">
          Start a new session
        </button>
      </div>

      {replay !== null && (
        <ReplayModal
          url={results[replay]?.videoUrl ?? null}
          result={results[replay]}
          language={language}
          onClose={() => setReplay(null)}
        />
      )}
    </main>
  );
}

function ResultCard({
  index, question, result, language, onReplay, onPracticeAgain,
}: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  const perfect = result && result.faceScore === 100 && result.grammarScore === 100;

  useEffect(() => {
    if (perfect && cardRef.current) {
      const r = cardRef.current.getBoundingClientRect();
      fireCardConfetti({ x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const combined = result ? Math.round((result.faceScore + result.grammarScore) / 2) : 0;

  return (
    <div ref={cardRef}
      className={`relative overflow-hidden rounded-3xl border p-5 transition ${
        perfect ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_30px_rgba(34,197,94,0.3)]" : "border-slate-800 bg-slate-900/50"
      }`}>
      {perfect && <div className="absolute right-3 top-3 animate-pop text-2xl">🎉</div>}
      <div className="mb-1 text-xs font-medium text-brand-400">Question {index}</div>
      <p className="mb-4 line-clamp-2 font-medium">{question}</p>

      {result?.videoUrl ? (
        <video src={result.videoUrl} className="mb-4 aspect-video w-full rounded-xl object-cover -scale-x-100" muted />
      ) : (
        <div className="mb-4 flex aspect-video w-full items-center justify-center rounded-xl bg-slate-800 text-slate-500">
          No recording
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Score label={t(language, "faceScore")} v={result?.faceScore ?? 0} />
        <Score label={t(language, "grammarScore")} v={result?.grammarScore ?? 0} />
        <Score label={t(language, "combined")} v={combined} bold />
      </div>

      {result?.feedback && <p className="mt-3 text-xs text-slate-400">💬 {result.feedback}</p>}

      <div className="mt-4 flex gap-2">
        <button onClick={onReplay} disabled={!result?.videoUrl}
          className="flex-1 rounded-xl bg-slate-800 py-2 text-sm hover:bg-slate-700 disabled:opacity-40">
          ▶ {t(language, "replay")}
        </button>
        <button onClick={onPracticeAgain}
          className="flex-1 rounded-xl bg-brand-600 py-2 text-sm hover:bg-brand-500">
          🔁 {t(language, "practiceAgain")}
        </button>
      </div>
    </div>
  );
}

function Score({ label, v, bold }: { label: string; v: number; bold?: boolean }) {
  const color = v >= 80 ? "text-emerald-400" : v >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="rounded-xl bg-slate-800/60 py-2">
      <div className={`${bold ? "text-2xl" : "text-xl"} font-bold ${color}`}>{v}</div>
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
    </div>
  );
}

function ReplayModal({ url, result, language, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white">✕</button>
        <h3 className="mb-4 text-lg font-semibold">Replay with scores</h3>
        {url ? (
          <video src={url} controls autoPlay className="w-full rounded-xl -scale-x-100" />
        ) : <p className="text-slate-400">Recording unavailable.</p>}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Score label={t(language, "faceScore")} v={result?.faceScore ?? 0} />
          <Score label={t(language, "grammarScore")} v={result?.grammarScore ?? 0} />
          <Score label={t(language, "combined")} v={Math.round(((result?.faceScore ?? 0) + (result?.grammarScore ?? 0)) / 2)} bold />
        </div>
      </div>
    </div>
  );
}