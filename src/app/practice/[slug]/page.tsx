"use client";
import { useEffect, useRef, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { FaceScorer, type FaceMetrics } from "@/lib/faceScoring";
import ConfidenceGauge from "@/components/ConfidenceGauge";
import {
  FaceLandmarker, FilesetResolver, type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";
import Transcription from "@/components/Transcription";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import Progress from "@/components/ui/Progress";
import Waveform from "@/components/ui/Waveform";

const emptyMetrics: FaceMetrics = {
  confidence: 50, eyeContact: 50, nervousness: 30, engagement: 50, headStability: 70,
};

export default function Practice({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: activeQuestion } = use(params);
  // Starts false on both server and client: reading the persist API during the
  // server render threw (it only exists in the browser), which 500'd this
  // route. The subscription is also kept alive until unmount — the previous
  // code unsubscribed on the same tick, so the callback could never fire.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persist = useSessionStore.persist;
    if (!persist) { setHydrated(true); return; }
    if (persist.hasHydrated()) { setHydrated(true); return; }
    return persist.onFinishHydration(() => setHydrated(true));
  }, []);

  if (!hydrated) {
    return (
      <PageShell title="Practice" titleSrOnly>
        <p role="status" className="text-center text-fg-muted">Loading your session…</p>
      </PageShell>
    );
  }

  return <PracticeContent activeQuestion={Number(activeQuestion)} />;
}

const PracticeContent = ({ activeQuestion }: { activeQuestion: number }) => {
  const router = useRouter();
  const { questions, saveResult } = useSessionStore();
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
  const [recording, setRecording] = useState(false);
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

        const recorder = new MediaRecorder(stream, { mimeType: pickMime() });
        recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        recorder.start();
        recorder.pause();
        recorderRef.current = recorder;

        setReady(true);
        loop();
      } catch (e) {
        setError(
          "We couldn't reach your camera and microphone. Check that this site is allowed to use them in your browser's site settings, then reload. " +
          String(e)
        );
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
  async function finishQuestion({
    transcript, pronScore, grammarScore, feedback, seniority_match,
  }: {
    transcript: string; pronScore: number; grammarScore: number;
    feedback: string; seniority_match: string;
  }) {
    const recorder = recorderRef.current;
    const videoUrl = await new Promise<string | null>((resolve) => {
      if (!recorder || recorder.state === "inactive") return resolve(null);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        resolve(URL.createObjectURL(blob));
      };
      recorder.stop();
    });

    const fs = faceSamples.current;
    const faceScore = fs.length
      ? Math.round(fs.reduce((a, b) => a + b, 0) / fs.length)
      : metrics.confidence;

    saveResult(q.id, {
      faceScore, grammarScore, pronunciationScore: pronScore || 0,
      feedback, seniorityMatch: seniority_match as never,
      transcript, videoUrl, completed: true,
    });

    if (activeQuestion < questions.length - 1) {
      router.push("/practice/" + (activeQuestion + 1));
    } else {
      router.push("/results");
    }
  }

  const triggerRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) {
      setError("The recorder didn't start. Reload the page to try again.");
      return;
    }
    if (rec.state === "recording") {
      rec.pause();
      setRecording(false);
    } else if (rec.state === "paused") {
      rec.resume();
      setRecording(true);
    }
  }, []);

  if (!q) {
    return (
      <PageShell title="That question isn't in this session" lead="Head back and start again.">
        <Button size="lg" onClick={() => router.push("/")}>Start a session</Button>
      </PageShell>
    );
  }

  return (
    <PageShell title="Practice" titleSrOnly width="wide" backHref="/study" backLabel="Study">
      <div className="space-y-6">
        <Progress current={activeQuestion} total={questions.length} />

        <div className="flex items-start gap-4 sm:gap-6">
          <span aria-hidden className="stepnum hidden text-5xl font-medium sm:block">
            {String(activeQuestion + 1).padStart(2, "0")}
          </span>
          <h2 className="text-2xl font-medium sm:text-3xl">{q.question}</h2>
        </div>

        {/* Real mic level, not decoration: flat until you are actually
            recording, and frozen entirely under prefers-reduced-motion. */}
        <Waveform stream={streamRef.current} active={recording} bars={44} />

        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          {/* LEFT: answer area */}
          <div className="space-y-4">
            <Transcription
              activeQuestion={activeQuestion}
              setError={setError}
              transcriptFinished={finishQuestion}
              stream={streamRef.current}
              triggerRecording={triggerRecording}
            />
            {error && <Alert tone="warning" title="Something needs your attention">{error}</Alert>}
          </div>

          {/* RIGHT: camera + gauge */}
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
              {/* Mirrored once, here. The old markup applied both `flip-rtl`
                  and `-scale-x-100`, so in Farsi the two cancelled out and the
                  preview came back un-mirrored. */}
              <video
                ref={videoRef}
                muted
                playsInline
                aria-label="Your camera preview"
                className="aspect-[4/3] w-full -scale-x-100 object-cover"
              />
              {!ready && !error && (
                <p
                  role="status"
                  className="absolute inset-0 flex items-center justify-center bg-black/60 p-4 text-center text-sm text-white"
                >
                  Starting your camera…
                </p>
              )}
              {recording && (
                <p className="absolute start-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                  <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-danger" />
                  Recording
                </p>
              )}
            </div>
            <Card pad="sm">
              <ConfidenceGauge m={metrics} />
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

function pickMime() {
  const opts = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const o of opts) if (MediaRecorder.isTypeSupported(o)) return o;
  return "video/webm";
}
