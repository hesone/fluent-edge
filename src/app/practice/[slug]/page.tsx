"use client";
import { useEffect, useRef, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { isRTL, t } from "@/lib/i18n";
import { FaceScorer, type FaceMetrics } from "@/lib/faceScoring";
import { WhisperStream } from "@/lib/whisperClient";
import { matchTranscript, pronunciationScore, type WordState } from "@/lib/pronunciation";
import ConfidenceGauge from "@/components/ConfidenceGauge";
import WordSpans from "@/components/WordSpans";
import LiveTranscript from "@/components/LiveTranscript";
import Stepper from "@/components/Stepper";
import {
  FaceLandmarker, FilesetResolver, type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

const emptyMetrics: FaceMetrics = {
  confidence: 50, eyeContact: 50, nervousness: 30, engagement: 50, headStability: 70,
};

export default function Practice({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: activeQuestion} = use(params)
  const [hydrated, setHydrated] = useState(useSessionStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useSessionStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    if (useSessionStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    unsub();
  }, []);

  if (!hydrated) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading your session...</div>;
  }

  return <PracticeContent activeQuestion={Number(activeQuestion)} />;
}

const PracticeContent = ({ activeQuestion }: { activeQuestion: number }) => {
  const router = useRouter();

  const {
    questions, language, seniority, saveResult,
  } = useSessionStore();

  const rtl = isRTL(language);
  const q = questions[activeQuestion];
  const words = q ? q.idealAnswer.split(/\s+/).filter(Boolean) : [];

  // refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const scorerRef = useRef(new FaceScorer());
  const whisperRef = useRef<WhisperStream | null>(null);
  const rafRef = useRef<number>(0);
  const faceSamples = useRef<number[]>([]);
  const transcriptRef = useRef("");

  // state
  const [metrics, setMetrics] = useState<FaceMetrics>(emptyMetrics);
  const [transcript, setTranscript] = useState("");
  const [states, setStates] = useState<WordState[]>(words.map(() => "pending"));
  const [allGreen, setAllGreen] = useState(false);  // first phase done
  const [memoryDone, setMemoryDone] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [ready, setReady] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");

  // ---- Setup camera + mic + models ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
        });
        if (!mounted) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // MediaPipe FaceLandmarker
        const filesets = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );
        landmarkerRef.current = await FaceLandmarker.createFromOptions(filesets, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: false,
        });

        // Whisper streaming (best-effort; works only if WS server running)
        try {
          whisperRef.current = new WhisperStream((text, isFinal) => {
            transcriptRef.current = isFinal
              ? (transcriptRef.current + " " + text).trim()
              : transcriptRef.current;
            const display = isFinal ? transcriptRef.current : (transcriptRef.current + " " + text).trim();
            setTranscript(display);
            handleTranscript(display);
          });
          await whisperRef.current.start(stream);
        } catch (we) {
          console.warn("Whisper unavailable", we);
          setError("Whisper WebSocket not connected — start the whisper server (see README). Face scoring still works.");
        }

        // Recording
        const recorder = new MediaRecorder(stream, { mimeType: pickMime() });
        recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        recorder.start();
        recorderRef.current = recorder;

        setReady(true);
        loop();
      } catch (e) {
        setError("Camera/Mic permission denied: " + String(e));
      }
    })();

    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
      whisperRef.current?.stop();
      recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestion]);

  // ---- FaceMesh loop ----
  const loop = useCallback(() => {
    const run = () => {
      const v = videoRef.current;
      const lm = landmarkerRef.current;
      if (v && lm && v.readyState >= 2) {
        const res: FaceLandmarkerResult = lm.detectForVideo(v, performance.now());
        if (res.faceLandmarks?.[0]) {
          const m = scorerRef.current.update(res.faceLandmarks[0]);
          setMetrics(m);
          faceSamples.current.push(m.confidence);
        }
      }
      rafRef.current = requestAnimationFrame(run);
    };
    rafRef.current = requestAnimationFrame(run);
  }, []);

  // ---- Transcript → word matching ----
  function handleTranscript(text: string) {
    const { states: st } = matchTranscript(text, words);
    setStates(st);
    const everyGreen = st.length > 0 && st.every((s) => s === "correct");
    if (everyGreen && !allGreen) {
      setAllGreen(true);
      // reset transcript baseline for memory phase
      transcriptRef.current = "";
      setTranscript("");
      setStates(words.map(() => "pending"));
    }
  }

  // In memory phase, matching reveals karaoke words; full match => done
  useEffect(() => {
    if (allGreen && !memoryDone) {
      const { states: st } = matchTranscript(transcript, words);
      setStates(st);
      if (st.length && st.every((s) => s === "correct")) setMemoryDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, allGreen]);

  // ---- Finish & grade ----
  async function finishQuestion() {
    setGrading(true);
    // stop recording, build video URL
    const recorder = recorderRef.current;
    const videoUrl = await new Promise<string | null>((resolve) => {
      if (!recorder || recorder.state === "inactive") return resolve(null);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        resolve(URL.createObjectURL(blob));
      };
      recorder.stop();
    });

    // average face score
    const fs = faceSamples.current;
    const faceScore = fs.length ? Math.round(fs.reduce((a, b) => a + b, 0) / fs.length) : metrics.confidence;
    const pron = pronunciationScore(states.length ? states : words.map(() => "correct"));

    // grammar via Ollama
    let grammarScore = pron, feedback = "", seniority_match = seniority;
    try {
      const res = await fetch("/api/grade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question, idealAnswer: q.idealAnswer,
          userAnswer: transcriptRef.current || transcript || q.idealAnswer,
          seniority, language,
        }),
      });
      const data = await res.json();
      if (typeof data.score === "number") {
        grammarScore = data.score; feedback = data.feedback; seniority_match = data.seniority_match;
      }
    } catch { /* fallback to pron */ }

    saveResult(q.id, {
      faceScore, grammarScore, pronunciationScore: pron,
      feedback, seniorityMatch: seniority_match as any,
      transcript: transcriptRef.current || transcript, videoUrl, completed: true,
    });

    // next or results
    if (activeQuestion < questions.length - 1) {
      // reset handled by effect via activeQuestion change (remount of effect)
      router.push("/practice/" + (activeQuestion + 1));
    } else {
      router.push("/results");
    }
  }

  if (!q) return <div className="flex min-h-screen items-center justify-center text-slate-400">No question.</div>;

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Stepper current={activeQuestion} total={questions.length} />

        <h2 className="animate-fade-in text-2xl font-bold">{q.question}</h2>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* LEFT: answer area */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  {allGreen ? "From Memory 🧠" : t(language, "idealAnswer")}
                </span>
                {allGreen && !memoryDone && (
                  <button onClick={() => setShowHint((s) => !s)}
                    className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700">
                    {showHint ? "Hide hint" : t(language, "showHint")}
                  </button>
                )}
              </div>

              {/* Phase 1: read-and-pronounce; Phase 2: karaoke from memory */}
              {(!allGreen || showHint) && (
                <WordSpans words={words} states={showHint && allGreen ? words.map(() => "pending") : states}
                  hidden={false} karaokeMode={false} />
              )}
              {allGreen && !showHint && (
                <WordSpans words={words} states={states} hidden={false} karaokeMode />
              )}

              {memoryDone && (
                <div className="mt-6 animate-fade-in rounded-2xl bg-emerald-500/10 p-4 text-emerald-300">
                  ✓ Excellent! You recited the full answer.
                </div>
              )}
            </div>

            <LiveTranscript text={transcript} />

            <div className="flex gap-3">
              {memoryDone ? (
                <button onClick={finishQuestion} disabled={grading}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-4 font-semibold transition hover:brightness-110 disabled:opacity-50">
                  {grading ? "Scoring…" :
                    activeQuestion < questions.length - 1 ? t(language, "nextQuestion") : "Finish & See Results"}
                </button>
              ) : (
                <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/40 py-4 text-center text-slate-400">
                  {allGreen ? "🎤 Now say the full answer from memory…" : "🎤 Read the answer aloud — words turn green as you nail them."}
                </div>
              )}
              <button onClick={finishQuestion} disabled={grading}
                className="rounded-2xl border border-slate-700 px-5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">
                {grading ? t(language, "scoring") : t(language, "skipQuestion")}
              </button>
            </div>

            {error && <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-400">{error}</p>}
          </div>

          {/* RIGHT: camera + gauge */}
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-black">
              <video ref={videoRef} muted playsInline className="flip-rtl aspect-[4/3] w-full -scale-x-100 object-cover" />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                  Initializing camera & AI…
                </div>
              )}
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> REC
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
              <ConfidenceGauge m={metrics} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function pickMime() {
  const opts = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const o of opts) if (MediaRecorder.isTypeSupported(o)) return o;
  return "video/webm";
}