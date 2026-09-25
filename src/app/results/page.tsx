"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LuPlay, LuRotateCcw } from "react-icons/lu";
import { useSessionStore, jdKeyOf, MIN_APPROVED_STORIES, INTERVIEW_STAGES, type QuestionResult } from "@/store/useSessionStore";
import { STAGES, storyGaps } from "@/lib/interview";
import { Lang, t } from "@/lib/i18n";
import { fireCardConfetti, FullPageConfetti } from "@/components/Confetti";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import PageShell from "@/components/ui/PageShell";
import ScoreTile from "@/components/ui/ScoreTile";

export default function Results() {
  const router = useRouter();
  const { questions, results, language, reset, jdText, storyBanks, setOnboarding } = useSessionStore();
  const sessionStage = questions[0]?.stage;
  const bank = sessionStage && jdText.trim() ? storyBanks[jdKeyOf(jdText)] : undefined;
  const gaps = storyGaps(bank?.responsibilities, MIN_APPROVED_STORIES);
  const nextStage = sessionStage ? INTERVIEW_STAGES[INTERVIEW_STAGES.indexOf(sessionStage) + 1] : undefined;
  const [replay, setReplay] = useState<number | null>(null);

  const allPerfect = useMemo(
    () =>
      questions.length > 0 &&
      questions.every((q) => {
        const r = results[q.id];
        return r && r.faceScore === 100 && r.grammarScore === 100;
      }),
    [questions, results]
  );

  if (!questions.length) {
    return (
      <PageShell title="No results yet" lead="Finish a practice session and your scores will appear here.">
        <Button size="lg" onClick={() => router.push("/")}>Start a session</Button>
      </PageShell>
    );
  }

  const replayResult = replay !== null ? results[replay] : undefined;

  return (
    <PageShell size="hero" eyebrow="Session complete" title={t(language, "yourScores")} width="wide" backHref="/" backLabel="Set-up">
      {allPerfect && <FullPageConfetti />}

      <div className="space-y-8">
        {allPerfect && (
          <p role="status" className="animate-pop text-center text-xl font-semibold text-accent-text">
            🏆 {t(language, "allPerfect")}
          </p>
        )}

        <ul className="grid gap-5 sm:grid-cols-2">
          {questions.map((q, i) => (
            <li key={q.id}>
              <ResultCard
                index={i + 1}
                question={q.question}
                result={results[q.id]}
                language={language}
                onReplay={() => setReplay(q.id)}
                onPracticeAgain={() =>
                  router.push("/practice/" + questions.findIndex((x) => x.id === q.id))
                }
              />
            </li>
          ))}
        </ul>

        {bank && gaps.length > 0 && (
          <Card pad="lg" className="space-y-4">
            <div>
              <p className="eyebrow">{t(language, "storyBank")}</p>
              <h2 className="mt-1 text-2xl font-medium">{t(language, "missingStories")}</h2>
              <p className="mt-2 text-fg-muted">
                These responsibilities of the role still lean on drafted stories. Add one of your own before the real interview —
                interviewers dig into details, and it&apos;s easier when the story is truly yours.
              </p>
            </div>
            <ul className="space-y-2">
              {gaps.map(({ r, approved, own }) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-sm text-fg-muted">
                    {own === 0 ? "No story of your own" : `${approved} of ${MIN_APPROVED_STORIES} stories in use`}
                    {r.prompts.find((p) => !p.storyId) && <> · Try: “{r.prompts.find((p) => !p.storyId)!.prompt}”</>}
                  </span>
                </li>
              ))}
            </ul>
            <Button onClick={() => router.push("/stories")}>Add stories</Button>
          </Card>
        )}

        {sessionStage && (
          <Card pad="md" className="flex flex-wrap items-center justify-between gap-3">
            <p>
              You practised the <span className="font-semibold">{STAGES[sessionStage].label}</span> round.
              {nextStage && <> Next in the loop: {STAGES[nextStage].label}.</>}
            </p>
            {nextStage && (
              <Button
                variant="secondary"
                onClick={() => {
                  setOnboarding({ stage: nextStage });
                  router.push(jdText.trim() ? "/stories" : "/");
                }}
              >
                Prepare for {STAGES[nextStage].short}
              </Button>
            )}
          </Card>
        )}

        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => { reset(); router.push("/"); }}>
            Start a new session
          </Button>
        </div>
      </div>

      <Dialog
        open={replay !== null}
        onClose={() => setReplay(null)}
        title="Replay with scores"
      >
        <div className="space-y-4">
          {replayResult?.videoUrl ? (
            <video
              src={replayResult.videoUrl}
              controls
              autoPlay
              className="w-full rounded-xl -scale-x-100"
            />
          ) : (
            <p className="text-fg-muted">That recording is no longer available.</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <ScoreTile label={t(language, "faceScore")} value={replayResult?.faceScore ?? 0} />
            <ScoreTile label={t(language, "grammarScore")} value={replayResult?.grammarScore ?? 0} />
            <ScoreTile
              label={t(language, "combined")}
              value={Math.round(((replayResult?.faceScore ?? 0) + (replayResult?.grammarScore ?? 0)) / 2)}
              emphasis
            />
          </div>
        </div>
      </Dialog>
    </PageShell>
  );
}

function ResultCard({
  index, question, result, language, onReplay, onPracticeAgain,
}: {
  index: number;
  question: string;
  result?: QuestionResult;
  language: Lang;
  onReplay: () => void;
  onPracticeAgain: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const perfect = !!result && result.faceScore === 100 && result.grammarScore === 100;

  useEffect(() => {
    if (perfect && cardRef.current) {
      const r = cardRef.current.getBoundingClientRect();
      fireCardConfetti({
        x: (r.left + r.width / 2) / window.innerWidth,
        y: (r.top + r.height / 2) / window.innerHeight,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const combined = result ? Math.round((result.faceScore + result.grammarScore) / 2) : 0;

  return (
    <Card
      ref={cardRef}
      tone={perfect ? "accent" : "default"}
      pad="sm"
      className="relative h-full"
    >
      {perfect && (
        <span aria-hidden className="absolute end-3 top-3 animate-pop text-2xl">🎉</span>
      )}
      <p className="eyebrow">
        Question {index}
        {perfect && <span className="sr-only"> — full marks</span>}
      </p>
      <h2 className="mb-4 mt-1 line-clamp-2 font-semibold">{question}</h2>

      {result?.videoUrl ? (
        <video
          src={result.videoUrl}
          muted
          aria-label={`Recording of your answer to question ${index}`}
          className="mb-4 aspect-video w-full rounded-xl object-cover -scale-x-100"
        />
      ) : (
        <div className="mb-4 flex aspect-video w-full items-center justify-center rounded-xl bg-surface-2 text-sm text-fg-muted">
          No recording
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <ScoreTile label={t(language, "faceScore")} value={result?.faceScore ?? 0} />
        <ScoreTile label={t(language, "grammarScore")} value={result?.grammarScore ?? 0} />
        <ScoreTile label={t(language, "combined")} value={combined} emphasis />
      </div>

      {result?.feedback && (
        <p className="mt-3 text-sm text-fg-muted">
          <span className="font-semibold text-fg">Feedback: </span>
          {result.feedback}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={onReplay}
          disabled={!result?.videoUrl}
        >
          <LuPlay aria-hidden className="h-4 w-4" />
          {t(language, "replay")}
        </Button>
        <Button size="sm" className="flex-1" onClick={onPracticeAgain}>
          <LuRotateCcw aria-hidden className="h-4 w-4" />
          {t(language, "practiceAgain")}
        </Button>
      </div>
    </Card>
  );
}
