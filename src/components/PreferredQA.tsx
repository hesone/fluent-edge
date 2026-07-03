"use client";
import { useState } from "react";
import { useSessionStore, Converstion, MAX_PREFERRED_QA } from "@/store/useSessionStore";
import { Lang, t } from "@/lib/i18n";

interface Props {
  tab: Converstion;
  language: Lang;
}

export default function PreferredQA({ tab, language }: Props) {
  const { preferredQA, addPreferredQA, updatePreferredQA, removePreferredQA } = useSessionStore();
  const items = preferredQA[tab] ?? [];

  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const full = items.length >= MAX_PREFERRED_QA;

  function handleAdd() {
    const q = question.trim();
    if (!q || full) return;
    addPreferredQA(tab, q, answer.trim());
    setQuestion("");
    setAnswer("");
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-xl border px-4 py-4 transition ${
          open || items.length ? "border-brand-500 bg-brand-500/10" : "border-slate-700 hover:border-slate-600"
        }`}
      >
        <span className="flex items-center gap-2 font-semibold">
          <span className="text-2xl">📝</span>
          {t(language, "preferredQA")}
        </span>
        <span className="text-sm text-slate-400">
          {t(language, "qaCount", { n: items.length, max: MAX_PREFERRED_QA })} {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs text-slate-400">
            {t(language, "preferredQAHint", { max: MAX_PREFERRED_QA })}
          </p>

          {/* Existing items — editable in place */}
          {items.map((item, i) => (
            <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-400">#{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removePreferredQA(tab, item.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  ✕ {t(language, "removeQA")}
                </button>
              </div>
              <input
                type="text"
                className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-sm"
                value={item.question}
                onChange={(e) => updatePreferredQA(tab, item.id, { question: e.target.value })}
              />
              <textarea
                rows={2}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-sm"
                value={item.answer}
                placeholder={t(language, "yourAnswer")}
                onChange={(e) => updatePreferredQA(tab, item.id, { answer: e.target.value })}
              />
            </div>
          ))}

          {/* Add new */}
          {full ? (
            <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-400">
              {t(language, "maxQAReached", { max: MAX_PREFERRED_QA })}
            </p>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-slate-700 p-3">
              <input
                type="text"
                className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-sm"
                placeholder={t(language, "yourQuestion")}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <textarea
                rows={2}
                className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-sm"
                placeholder={t(language, "yourAnswer")}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!question.trim()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
              >
                + {t(language, "addQA")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
