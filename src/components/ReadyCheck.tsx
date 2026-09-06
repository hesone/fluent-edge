"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LuCamera, LuMic, LuCircleCheck } from "react-icons/lu";
import { useSessionStore } from "@/store/useSessionStore";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageShell from "@/components/ui/PageShell";
import Waveform from "@/components/ui/Waveform";

type Phase = "intro" | "requesting" | "ready" | "denied";

/**
 * Pre-flight for a practice session.
 *
 * The camera and microphone used to start the instant you landed on
 * /practice/0 — no explanation, no way to see what was being captured, and no
 * way to change device. For an app that scores *delivery*, an unnoticed wrong
 * microphone quietly ruins a ten-question session, and the user only finds out
 * from a bad score at the end.
 *
 * So: say why the hardware is needed before asking for it, then show what is
 * actually being captured — a live preview and a real level meter — and let the
 * user switch device before anything is recorded.
 */
export default function ReadyCheck({ onReady }: { onReady: () => void }) {
  const { videoDeviceId, audioDeviceId, setDevices } = useSessionStore();

  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState("");
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const open = useCallback(async (video?: string, audio?: string) => {
    stop();
    const s = await navigator.mediaDevices.getUserMedia({
      video: { ...(video ? { deviceId: { exact: video } } : {}), width: 640, height: 480, facingMode: "user" },
      audio: {
        ...(audio ? { deviceId: { exact: audio } } : {}),
        channelCount: 1, echoCancellation: true, noiseSuppression: true,
      },
    });
    streamRef.current = s;
    setStream(s);
    if (videoRef.current) {
      videoRef.current.srcObject = s;
      await videoRef.current.play().catch(() => {});
    }
    // Labels are only populated once permission has been granted, which is why
    // the device lists can't be shown before this point.
    const list = await navigator.mediaDevices.enumerateDevices();
    setCams(list.filter((d) => d.kind === "videoinput"));
    setMics(list.filter((d) => d.kind === "audioinput"));
    return s;
  }, [stop]);

  async function request() {
    setPhase("requesting");
    setError("");
    try {
      const s = await open(videoDeviceId || undefined, audioDeviceId || undefined);
      const v = s.getVideoTracks()[0]?.getSettings().deviceId ?? "";
      const a = s.getAudioTracks()[0]?.getSettings().deviceId ?? "";
      setDevices({ videoDeviceId: v, audioDeviceId: a });
      setPhase("ready");
    } catch (e) {
      setPhase("denied");
      setError(String(e));
    }
  }

  async function switchDevice(kind: "video" | "audio", id: string) {
    setDevices(kind === "video" ? { videoDeviceId: id } : { audioDeviceId: id });
    try {
      await open(
        kind === "video" ? id : videoDeviceId || undefined,
        kind === "audio" ? id : audioDeviceId || undefined
      );
    } catch (e) {
      setError("Couldn't switch to that device. " + String(e));
    }
  }

  // Hand the hardware back before the practice screen opens its own stream.
  useEffect(() => stop, [stop]);

  function start() {
    stop();
    setDevices({ devicesReady: true });
    onReady();
  }

  return (
    <PageShell
      size="hero"
      step="02"
      eyebrow="Before you start"
      title="Let's check your camera and mic."
      lead="You'll be scored partly on delivery — eye contact, pace, how steady you sound — so it's worth ten seconds to make sure we're capturing the right thing."
      backHref="/study"
      backLabel="Study"
    >
      <Card pad="lg" className="space-y-6">
        {phase === "intro" && (
          <>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <LuCamera aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
                <p className="text-sm">
                  <span className="font-semibold">Camera</span> — read only on your device, by
                  MediaPipe, to estimate eye contact and steadiness.{" "}
                  <span className="text-fg-muted">Video is never uploaded.</span>
                </p>
              </li>
              <li className="flex gap-3">
                <LuMic aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
                <p className="text-sm">
                  <span className="font-semibold">Microphone</span> — transcribed so your words can
                  be matched against the answer.{" "}
                  <span className="text-fg-muted">
                    Where that happens depends on your mode; see the privacy notes.
                  </span>
                </p>
              </li>
            </ul>
            <Button size="lg" onClick={request}>Turn on camera and mic</Button>
          </>
        )}

        {phase === "requesting" && (
          <p role="status" className="text-fg-muted">
            Waiting for you to allow access in your browser…
          </p>
        )}

        {phase === "denied" && (
          <>
            <Alert tone="error" title="We couldn't get access">
              Your browser blocked the camera or microphone. Open the site permissions — the icon at
              the left of the address bar — allow both, then try again.
            </Alert>
            <p className="text-2xs text-fg-muted">{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={request}>Try again</Button>
              <Button variant="secondary" onClick={start}>
                Continue without checking
              </Button>
            </div>
          </>
        )}

        {phase === "ready" && (
          <>
            <div className="grid gap-5 sm:grid-cols-[1fr_1fr]">
              <div className="overflow-hidden rounded-xl border border-line bg-black">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  aria-label="Camera preview"
                  className="aspect-[4/3] w-full -scale-x-100 object-cover"
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold">Say something — the bars should move.</p>
                <Waveform stream={stream} active bars={28} />
                <p className="text-sm text-fg-muted">
                  If they stay flat, pick a different microphone below.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Picker
                label="Camera" devices={cams} value={videoDeviceId}
                onChange={(id) => switchDevice("video", id)}
              />
              <Picker
                label="Microphone" devices={mics} value={audioDeviceId}
                onChange={(id) => switchDevice("audio", id)}
              />
            </div>

            {error && <Alert tone="warning">{error}</Alert>}

            <div className="border-t border-line pt-6">
              <Button size="lg" fullWidth onClick={start}>
                <LuCircleCheck aria-hidden className="h-4 w-4" />
                Looks good — start practising
              </Button>
              <p className="mt-3 text-center text-sm text-fg-muted">
                Recording only begins when you press the record button on each question.
              </p>
            </div>
          </>
        )}
      </Card>
    </PageShell>
  );
}

function Picker({
  label, devices, value, onChange,
}: {
  label: string; devices: MediaDeviceInfo[]; value: string; onChange: (id: string) => void;
}) {
  const id = `pick-${label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-sm text-fg"
      >
        {devices.length === 0 && <option value="">No device found</option>}
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
}
