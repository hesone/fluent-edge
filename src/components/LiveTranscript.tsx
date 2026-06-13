"use client";
export default function LiveTranscript({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute h-2 w-2 animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="h-2 w-2 rounded-full bg-red-500" />
        </span>
        Live transcript
      </div>
      <p className="min-h-[3rem] text-slate-200 max-h-48 overflow-y-auto">{text || <span className="text-slate-600">Listening…</span>}</p>
    </div>
  );
}