"use client";
import { useId, useState } from "react";
import { LuChevronDown, LuPlus, LuTrash2 } from "react-icons/lu";
import { useSessionStore, Converstion, MAX_PREFERRED_QA } from "@/store/useSessionStore";
import { Lang, t } from "@/lib/i18n";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { TextArea, TextField } from "@/components/ui/Field";

interface Props {
  tab: Converstion;
  language: Lang;
}

/**
 * Optional list of the user's own questions and answers.
 *
 * Rebuilt as a proper disclosure: the toggle is a button with
 * `aria-expanded`/`aria-controls` pointing at the panel, so assistive tech
 * announces it as collapsible and reports its state. Previously it was a
 * button with a decorative ▲/▼ and no relationship to the content it revealed,
 * and every input inside was unlabelled.
 */
export default function PreferredQA({ tab, language }: Props) {
  const { preferredQA, addPreferredQA, updatePreferredQA, removePreferredQA } = useSessionStore();
  const items = preferredQA[tab] ?? [];

  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const full = items.length >= MAX_PREFERRED_QA;
  const count = t(language, "qaCount", { n: items.length, max: MAX_PREFERRED_QA });

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
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-4 text-start
          transition-colors duration-fast
          ${open || items.length
            ? "border-accent bg-accent-soft"
            : "border-line hover:border-line-strong hover:bg-surface-2"}`}
      >
        <span aria-hidden className="text-2xl leading-none">📝</span>
        <span className="font-semibold">{t(language, "preferredQA")}</span>
        <span className="ms-auto flex items-center gap-2 text-sm text-fg-muted">
          {count}
          <LuChevronDown
            aria-hidden
            className={`h-4 w-4 transition-transform duration-fast ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* Kept mounted but hidden so the count above stays accurate and the
          panel's own state survives collapsing. */}
      <div id={panelId} hidden={!open} className="mt-3 space-y-4 rounded-2xl border border-line bg-surface-2 p-4">
        <p className="text-sm text-fg-muted">
          {t(language, "preferredQAHint", { max: MAX_PREFERRED_QA })}
        </p>

        {items.map((item, i) => (
          <div key={item.id} className="space-y-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-accent-text">#{i + 1}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removePreferredQA(tab, item.id)}
                aria-label={`${t(language, "removeQA")} — question ${i + 1}`}
              >
                <LuTrash2 aria-hidden className="h-4 w-4" />
                {t(language, "removeQA")}
              </Button>
            </div>
            <TextField
              label={`${t(language, "yourQuestion")} ${i + 1}`}
              labelHidden
              value={item.question}
              onChange={(e) => updatePreferredQA(tab, item.id, { question: e.target.value })}
            />
            <TextArea
              label={`${t(language, "yourAnswer")} ${i + 1}`}
              labelHidden
              rows={2}
              placeholder={t(language, "yourAnswer")}
              value={item.answer}
              onChange={(e) => updatePreferredQA(tab, item.id, { answer: e.target.value })}
            />
          </div>
        ))}

        {full ? (
          <Alert tone="warning">{t(language, "maxQAReached", { max: MAX_PREFERRED_QA })}</Alert>
        ) : (
          <div className="space-y-3 rounded-xl border-2 border-dashed border-line-strong p-4">
            <TextField
              label={t(language, "yourQuestion")}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <TextArea
              label={t(language, "yourAnswer")}
              rows={2}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <Button size="sm" onClick={handleAdd} disabled={!question.trim()}>
              <LuPlus aria-hidden className="h-4 w-4" />
              {t(language, "addQA")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
