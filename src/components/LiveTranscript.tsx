"use client";
import { t } from "@/lib/i18n";
import { useSessionStore } from "@/store/useSessionStore";

export default function LiveTranscript({ text, isStop }: { text: string; isStop: boolean }) {
  const { language } = useSessionStore();

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="mb-2 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-fg-muted">
        <span aria-hidden className="relative flex h-2 w-2">
          {!isStop && (
            <span className="absolute h-2 w-2 animate-ping rounded-full bg-danger opacity-75" />
          )}
          <span className={`h-2 w-2 rounded-full ${isStop ? "bg-line-strong" : "bg-danger"}`} />
        </span>
        {isStop ? t(language, "stopped") : t(language, "liveTranscript")}
      </p>
      {/* The transcript updates constantly while speaking; `aria-live="off"`
          keeps a screen reader from reading every partial result back over the
          user as they talk. */}
      <p aria-live="off" className="max-h-48 min-h-[3rem] overflow-y-auto leading-relaxed">
        {text || <span className="text-fg-muted">Listening…</span>}
      </p>
    </div>
  );
}
