"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionStore } from "@/store/useSessionStore";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import Waveform from "@/components/ui/Waveform";

/**
 * Optional camera/mic check, opened from the practice screen.
 *
 * This used to be a full-screen gate in front of practice, which made a
 * ten-second sanity check mandatory before every session. It is now a dialog
 * the user opens if they want it — the session starts regardless. What remains
 * non-optional is *permission*: without a camera and microphone there is
 * nothing to score, so the practice screen blocks progress to the next question
 * and points back here.
 */
export default function DeviceCheckDialog({
  open, onClose, onApplied,
}: {
  open: boolean;
  onClose: () => void;
  /** Called when devices change, so the practice screen can re-acquire. */
  onApplied: () => void;
}) {
  const { videoDeviceId, audioDeviceId, setDevices } = useSessionStore();
  const [error, setError] = useState("");
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [dirty, setDirty] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const open_ = useCallback(async (video?: string, audio?: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
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
    // Device labels are only populated once permission has been granted.
    const list = await navigator.mediaDevices.enumerateDevices();
    setCams(list.filter((d) => d.kind === "videoinput"));
    setMics(list.filter((d) => d.kind === "audioinput"));
  }, []);

  // The dialog runs its own preview stream, separate from the one the practice
  // screen holds, and hands the hardware back the moment it closes.
  useEffect(() => {
    if (!open) { stop(); return; }
    setError("");
    open_(videoDeviceId || undefined, audioDeviceId || undefined)
      .catch((e) => setError(
        "We couldn't open your camera and microphone. Allow them from the icon at the left of the " +
        "address bar, then reopen this check. " + String(e)
      ));
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function switchDevice(kind: "video" | "audio", id: string) {
    setDevices(kind === "video" ? { videoDeviceId: id } : { audioDeviceId: id });
    setDirty(true);
    try {
      await open_(
        kind === "video" ? id : videoDeviceId || undefined,
        kind === "audio" ? id : audioDeviceId || undefined
      );
    } catch (e) {
      setError("Couldn't switch to that device. " + String(e));
    }
  }

  function done() {
    stop();
    if (dirty) onApplied();
    setDirty(false);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={done}
      title="Check your camera and mic"
      footer={
        <div className="flex justify-end">
          <Button onClick={done}>{dirty ? "Apply and close" : "Close"}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-fg-muted">
          You&apos;re scored partly on delivery, so it&apos;s worth checking we&apos;re capturing the
          right camera and microphone. Video is read on your device only and never uploaded.
        </p>

        {error && <Alert tone="error" title="Can't reach your devices">{error}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-line bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              aria-label="Camera preview"
              className="aspect-[4/3] w-full -scale-x-100 object-cover"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Say something — the bars should move.</p>
            <Waveform stream={stream} active bars={24} />
            <p className="text-sm text-fg-muted">If they stay flat, try another microphone.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Picker label="Camera" devices={cams} value={videoDeviceId} onChange={(id) => switchDevice("video", id)} />
          <Picker label="Microphone" devices={mics} value={audioDeviceId} onChange={(id) => switchDevice("audio", id)} />
        </div>
      </div>
    </Dialog>
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
          <option key={d.deviceId || i} value={d.deviceId}>{d.label || `${label} ${i + 1}`}</option>
        ))}
      </select>
    </div>
  );
}
