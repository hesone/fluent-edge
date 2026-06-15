"use client";

import { t } from "@/lib/i18n";
import { useSessionStore } from "@/store/useSessionStore";

export default function LiveTranscript({ text, isStop }: { text: string; isStop: boolean }) {
	const { language } = useSessionStore();

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
        <span className="relative flex h-2 w-2">
          <span className={"absolute h-2 w-2 animate-ping rounded-full opacity-75 " + (isStop ? "" : "bg-red-500")} />
          <span className={"h-2 w-2 rounded-full " + (isStop ? "bg-slate-800" : "bg-red-500")} />
        </span>
        {isStop ? t(language, "stopped") : t(language, "liveTranscript")}
      </div>
      <p className="min-h-[3rem] text-slate-200 max-h-48 overflow-y-auto">{text || <span className="text-slate-600">Listening…</span>}</p>
    </div>
  );
}