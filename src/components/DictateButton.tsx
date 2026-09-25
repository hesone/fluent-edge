"use client";
import { useEffect, useRef, useState } from "react";
import { LuMic, LuMicOff } from "react-icons/lu";
import { createSTT, type STTAdapter } from "@/lib/stt";
import Button from "@/components/ui/Button";

/**
 * Speak instead of type. Final recognised segments are handed to `onText`
 * for the caller to append; interim text is ignored.
 */
export default function DictateButton({
  language, onText, disabled,
}: { language: string; onText: (text: string) => void; disabled?: boolean }) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState("");
  const sttRef = useRef<STTAdapter | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  function stop() {
    sttRef.current?.stop();
    sttRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  }

  useEffect(() => stop, []);

  async function start() {
    setError("");
    try {
      const stt = await createSTT((text, isFinal) => {
        if (isFinal && text.trim()) onTextRef.current(text.trim());
      });
      if (!stt.isSupported()) throw new Error("Speech input isn't supported in this browser — try Chrome or Edge.");
      if (stt.needsStream) streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      await stt.start(streamRef.current, { language });
      sttRef.current = stt;
      setOn(true);
    } catch (e) {
      stop();
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={on ? "danger" : "secondary"}
        size="sm"
        disabled={disabled}
        onClick={on ? stop : start}
        aria-pressed={on}
      >
        {on ? <LuMicOff aria-hidden className="h-4 w-4" /> : <LuMic aria-hidden className="h-4 w-4" />}
        {on ? "Stop dictating" : "Say it instead"}
      </Button>
      {error && <span role="alert" className="text-xs font-medium text-danger">{error}</span>}
    </span>
  );
}
