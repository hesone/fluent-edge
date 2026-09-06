"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LuArrowRight, LuPencil, LuRefreshCcw, LuVolume2, LuVolumeOff } from "react-icons/lu";
import { useSessionStore } from "@/store/useSessionStore";
import { t } from "@/lib/i18n";
import TTSSentence, { ChildHandle } from "@/components/TTSSentences";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextArea } from "@/components/ui/Field";
import PageShell from "@/components/ui/PageShell";
import Progress from "@/components/ui/Progress";
import { SkeletonText } from "@/components/ui/Skeleton";

export default function Study() {
  const router = useRouter();
  const { questions, resumeText, language, topic, setAnswerForQuestion } = useSessionStore();
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [idx, setIdx] = useState(0);
  const ttsRef = useRef<ChildHandle>(null);

  useEffect(() => {
    if (!loading && !!answer) {
      setAnswerForQuestion(q.id, answer);
      setAnswer("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, answer]);

  if (!questions.length) {
    return <Empty onBack={() => router.push("/")} />;
  }

  const q = questions[idx];
  const isLast = idx === questions.length - 1;

  const ask = async () => {
    setLoading(true);
    setAnswer("");
    const response = await fetch("/api/generate-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q?.question, topic, resume: resumeText }),
    });
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      setAnswer((prev) => prev + decoder.decode(value));
    }
    setLoading(false);
  };

  function startEditing() {
    if (playing) toggleReading();
    setDraft(q.idealAnswer);
    setEditing(true);
  }

  function saveEdit() {
    setAnswerForQuestion(q.id, draft.trim());
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(q.idealAnswer);
  }

  function proceed(qIdx?: number) {
    if (playing) toggleReading();
    setEditing(false);
    ttsRef.current?.stopReading();
    if (typeof qIdx === "number") {
      setIdx(qIdx);
      return;
    }
    if (!isLast) setIdx(idx + 1);
    else router.push("/practice/0");
  }

  function toggleReading() {
    if (ttsRef.current?.playing) {
      ttsRef.current.stopReading();
      setPlaying(false);
    } else {
      ttsRef.current?.readAloud();
      setPlaying(true);
    }
  }

  return (
    <PageShell title="Study" titleSrOnly backHref="/" backLabel="Set-up">
      <div className="space-y-6">
        <Progress current={idx} total={questions.length} />

        <Card pad="lg">
          <p className="eyebrow">Study mode</p>
          {/* The question is the point of the screen, so it is the heading. */}
          <h2 className="mt-2 text-2xl font-medium sm:text-3xl">{q.question}</h2>

          <section
            aria-label={t(language, "idealAnswer")}
            className="mt-6 rounded-2xl border border-accent-text/30 bg-accent-soft p-5 sm:p-6"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-2xs font-semibold uppercase tracking-wider text-accent-text">
                {t(language, "idealAnswer")}
              </h3>
              <div className="flex gap-2">
                {!loading && (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconOnly
                    disabled={editing}
                    onClick={toggleReading}
                    aria-label={playing ? "Stop reading the answer aloud" : "Read the answer aloud"}
                  >
                    {playing
                      ? <LuVolumeOff aria-hidden className="h-4 w-4" />
                      : <LuVolume2 aria-hidden className="h-4 w-4" />}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  iconOnly
                  disabled={loading || editing}
                  onClick={startEditing}
                  aria-label={t(language, "editAnswer")}
                >
                  <LuPencil aria-hidden className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  iconOnly
                  loading={loading}
                  disabled={editing}
                  onClick={ask}
                  aria-label="Write a different answer"
                >
                  {!loading && <LuRefreshCcw aria-hidden className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {editing ? (
              <div>
                <TextArea
                  label={t(language, "editAnswer")}
                  labelHidden
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={8}
                  autoFocus
                  className="text-lg"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={!draft.trim()}>
                    {t(language, "saveAnswer")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={cancelEdit}>
                    {t(language, "cancel")}
                  </Button>
                </div>
              </div>
            ) : !answer ? (
              loading ? (
                <SkeletonText lines={5} label="Writing an example answer…" />
              ) : (
                <TTSSentence
                  ref={ttsRef}
                  text={q.idealAnswer}
                  lang={language}
                  onDone={() => setPlaying(false)}
                />
              )
            ) : (
              <p className="text-lg leading-relaxed">{answer}</p>
            )}
          </section>

          <Button
            size="lg"
            fullWidth
            className="mt-8"
            disabled={loading}
            onClick={() => proceed()}
          >
            {isLast ? t(language, "startSession") : t(language, "readyToPractice")}
            <LuArrowRight aria-hidden className="flip-rtl h-4 w-4" />
          </Button>
        </Card>

        {/* Was a row of 8px dots with no labels: below the 24px minimum target
            and unusable with a screen reader. Now a labelled list of pages. */}
        <nav aria-label="Jump to a question">
          <ol className="flex flex-wrap justify-center gap-2">
            {questions.map((_, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => proceed(i)}
                  aria-current={i === idx ? "true" : undefined}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm
                    font-semibold transition-colors duration-fast
                    ${i === idx
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-line text-fg-muted hover:border-line-strong hover:bg-surface-2 hover:text-fg"}`}
                >
                  <span className="sr-only">Question </span>{i + 1}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </PageShell>
  );
}

function Empty({ onBack }: { onBack: () => void }) {
  return (
    <PageShell title="No session yet" lead="Set up a session and we'll write practice questions for you.">
      <Button size="lg" onClick={onBack}>Start a session</Button>
    </PageShell>
  );
}
