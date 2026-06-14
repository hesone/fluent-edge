"use client";
import { useEffect, useRef, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { isRTL } from "@/lib/i18n";
import { FaceScorer, type FaceMetrics } from "@/lib/faceScoring";
import ConfidenceGauge from "@/components/ConfidenceGauge";
import Stepper from "@/components/Stepper";
import {
  FaceLandmarker, FilesetResolver, type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import Transcription from "@/components/Transcription";

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

  const { questions, language, saveResult } = useSessionStore();

  const rtl = isRTL(language);
  const q = questions[activeQuestion];

  // refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const scorerRef = useRef(new FaceScorer());
  const rafRef = useRef<number>(0);
  const faceSamples = useRef<number[]>([]);

  // state
  const [metrics, setMetrics] = useState<FaceMetrics>(emptyMetrics);
  
  const [ready, setReady] = useState(false);
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

  // ---- Finish & grade ----
  async function finishQuestion({transcript, pronScore, grammarScore, feedback, seniority_match}: {transcript: string, pronScore: number, grammarScore: number, feedback: string, seniority_match: string}) {
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

    saveResult(q.id, {
      faceScore, grammarScore, pronunciationScore: pronScore || 0,
      feedback, seniorityMatch: seniority_match as any,
      transcript: transcript, videoUrl, completed: true,
    });

    // next or results
    if (activeQuestion < questions.length - 1) {
      // reset handled by effect via activeQuestion change (remount of effect)
      router.push("/practice/" + (activeQuestion + 1));
    } else {
      router.push("/results");
    }
  }
  
  const triggerRecording = useCallback(() => {
    if (recorderRef.current) {
      if (recorderRef.current.state === "recording") {
        recorderRef.current.pause();
      } else if (recorderRef.current.state === "paused") {
        recorderRef.current.resume();
      }
    } else {
      setError("Recorder not initialized");
    }
  }, [recorderRef.current]);

  if (!q) return <div className="flex min-h-screen items-center justify-center text-slate-400">No question.</div>;

  return (
    <main dir={rtl ? "rtl" : "ltr"} className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Stepper current={activeQuestion} total={questions.length} />

        <h2 className="animate-fade-in text-2xl font-bold">{q.question}</h2>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* LEFT: answer area */}
          <div className="space-y-6">
            <Transcription
            activeQuestion={activeQuestion}
            setError={setError}
            transcriptFinished={finishQuestion}
            stream={streamRef.current}
            triggerRecording={triggerRecording} />
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
              {recorderRef.current?.state === "recording" &&
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> REC
                </div>
              }
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