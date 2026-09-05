import { t, LangLevel } from "@/lib/i18n";
import { matchTranscript, pronunciationScore, WordState } from "@/lib/pronunciation";
import { createSTT, type STTAdapter } from "@/lib/stt";
import { MEDIA_WS_URL, type STTProvider } from "@/lib/config";
import { useSessionStore } from "@/store/useSessionStore";
import { useEffect, useRef, useState } from "react";
import LiveTranscript from "./LiveTranscript";
import WordSpans from "./WordSpans";

type TranscriptionProps = {
	activeQuestion: number;
	setError: (msg: string) => void;
	transcriptFinished: (result: {transcript: string, pronScore: number, grammarScore: number, feedback: string, seniority_match: string}) => void;
	stream: MediaStream | null;
	triggerRecording: () => void;
};

// How much of the answer must be correct to move to memory phase, per CEFR
// level: easier levels demand a perfect read, harder levels allow more slack.
const LEVEL_THRESHOLD: Record<LangLevel, number> = {
	a1: 1.0,
	a2: 0.98,
	b1: 0.96,
	b2: 0.94,
	c1: 0.92,
	c2: 0.9,
};
const MIN_THRESHOLD = 0.9;

// Long answers (>25 words) lower the threshold by 1% per extra word, never below 90%.
function getThreshold(level: LangLevel, wordCount: number): number {
	const base = LEVEL_THRESHOLD[level] ?? MIN_THRESHOLD;
	if (wordCount <= 25) return base;
	return Math.max(MIN_THRESHOLD, base - (wordCount - 25) * 0.01);
}

// Provider-specific error copy — tells the user which thing to go fix.
function unsupportedMessage(provider: STTProvider): string {
	return provider === "whisper"
		? "This browser can't open a WebSocket to the local media server. Face scoring still works."
		: "Speech recognition isn't supported in this browser — please use Chrome or Edge, or switch to local mode. Face scoring still works.";
}

function startFailureMessage(provider: STTProvider): string {
	return provider === "whisper"
		? `Can't reach the local media server at ${MEDIA_WS_URL} — start it with \`npm run media\`. Face scoring still works.`
		: "Couldn't start speech recognition — check the microphone permission. Face scoring still works.";
}

export default function Transcription({ activeQuestion, setError, transcriptFinished, stream, triggerRecording }: TranscriptionProps) {
  const sttRef = useRef<STTAdapter | null>(null);
	const transcriptRef = useRef("");

	// The mic stream lives in the parent and is re-created on remount. Read it
	// through a ref so the recognition callbacks always see the current one
	// without re-running the setup effect.
	const streamRef = useRef<MediaStream | null>(stream);
	streamRef.current = stream;

	const {
		questions, language, seniority, langLevel,
	} = useSessionStore();

	const q = questions[activeQuestion];
	const words = q ? q.idealAnswer.replace(/[!?;:"()\/\[\]{}]/g, " ").split(/\s+/).filter(Boolean) : [];

	const [transcript, setTranscript] = useState("");
	const [states, setStates] = useState<WordState[]>(words.map(() => "pending"));
	const [allGreen, setAllGreen] = useState(false);  // first phase done
	const [memoryDone, setMemoryDone] = useState(false);
	const [showHint, setShowHint] = useState(false);
	const [grading, setGrading] = useState(false);
	const [recording, setRecording] = useState(false);
	const [sttReady, setSttReady] = useState(false);
	const [sttProvider, setSttProvider] = useState<STTProvider | null>(null);

	// Set up the speech-to-text adapter — Web Speech online, whisper.cpp over
	// the local media server offline (src/lib/config.ts decides which).
	// Recreated per question so the result handler closes over the current
	// question's expected words.
	useEffect(() => {
		let disposed = false;
		setSttReady(false);

		(async () => {
			const adapter = await createSTT((text, isFinal) => {
				transcriptRef.current = isFinal
					? (transcriptRef.current + " " + text).trim()
					: transcriptRef.current;
				const display = isFinal ? transcriptRef.current : (transcriptRef.current + " " + text).trim();
				setTranscript(display);
				handleTranscript(display);
			});

			// The question may have changed while the provider was resolving.
			if (disposed) return;

			setSttProvider(adapter.provider);

			if (!adapter.isSupported()) {
				setError(unsupportedMessage(adapter.provider));
				return;
			}

			sttRef.current = adapter;
			setSttReady(true);
		})();

		return () => {
			disposed = true;
			sttRef.current?.stop();
			sttRef.current = null;
			setRecording(false);
			setSttReady(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeQuestion]);

	async function triggerTranscription() {
		const stt = sttRef.current;
		if (!stt) return;

		if (recording) {
			stt.stop();
			setRecording(false);
			triggerRecording();
			return;
		}

		try {
			// Web Speech opens the mic itself; whisper.cpp has to be fed the
			// stream the parent already holds for the camera.
			await stt.start(stt.needsStream ? streamRef.current : null, { language });
			setRecording(true);
			triggerRecording();
		} catch (e) {
			console.warn("STT start failed", e);
			setError(startFailureMessage(stt.provider));
		}
	}

	function resetTranscript() {
		sttRef.current?.reset(); // drop the in-flight utterance so stale speech can't repopulate
		transcriptRef.current = "";
		setTranscript("");
		setStates(words.map(() => "pending"));
	}

	useEffect(() => {
		const treshold = getThreshold(langLevel, words.length);
		const everyGreen = states.length > 0 && states.filter((s) => s === "correct").length / states.length >= treshold;
		const everyReaded = states.length > 0 && states.every(s => s !== "pending")
		if(everyReaded) {
			if (everyGreen) {
				if (!allGreen) {
					setAllGreen(true);
					// reset transcript baseline for memory phase
					resetTranscript();
				} else if (allGreen) {
					setMemoryDone(true);
					triggerTranscription();
				}
			} else {
				resetTranscript()
			}
		}
	},[states])

	// ---- Transcript → word matching ----
  const handleTranscript = (text: string) => {
    const { states: st } = matchTranscript(text, words);
    setStates(st);
	};

	// ---- Finish & grade ----
  async function onFinished() {
		if(recording) {
			triggerRecording();
			sttRef.current?.stop();
			setRecording(false);
		}
		
		if(!transcriptRef?.current && !transcript) {
			transcriptFinished({ transcript: transcriptRef.current || transcript, pronScore: 0, grammarScore: 0, feedback: "You Skip this question", seniority_match: 'Unknown' });
			return;
		}

    setGrading(true);
    const pron = pronunciationScore(states.length ? states : words.map(() => "correct"));
    let grammarScore = pron, feedback = "", seniority_match = seniority;
    try {
      const res = await fetch("/api/grade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question, idealAnswer: q.idealAnswer,
          userAnswer: transcriptRef.current || transcript || '',
          seniority, language,
        }),
      });
      const data = await res.json();
      if (typeof data.score === "number") {
        grammarScore = data.score; feedback = data.feedback; seniority_match = data.seniority_match;
      }
    } catch { /* fallback to pron */ }

		transcriptFinished({ transcript: transcriptRef.current || transcript, pronScore: pron, grammarScore, feedback, seniority_match });
  }

  return (
    <>
			<div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
				<div className="mb-3 flex items-center justify-between">
					<span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
						{allGreen ? "From Memory 🧠" : t(language, "idealAnswer")}
					</span>
					<div	className="flex items-center gap-2 text-xs text-slate-400 h-1">
						{sttProvider && (
							<span
								title={sttProvider === "whisper"
									? `whisper.cpp via the local media server (${MEDIA_WS_URL})`
									: "Web Speech API — recognition happens in your browser"}
								className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
								{sttProvider === "whisper" ? "local" : "online"}
							</span>
						)}
						{allGreen && !memoryDone && (
							<button onClick={() => setShowHint((s) => !s)}
								className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700">
								{showHint ? "Hide hint" : t(language, "showHint")}
							</button>
						)}
						
						{recording && !memoryDone &&
							<button onClick={triggerTranscription} disabled={!sttReady}
											className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700 disabled:opacity-40">
								{recording ? t(language, "stopRecording") : t(language, "startRecording")}
							</button>
						}
					</div>
				</div>

				{/* Phase 1: read-and-pronounce; Phase 2: karaoke from memory */}
				{(!allGreen || showHint) && (
					<WordSpans
						words={words}
						states={showHint && allGreen ? words.map(() => "pending") : states}
						hidden={false}
						karaokeMode={false} />
				)}
				{allGreen && !showHint && (
					<WordSpans words={words} states={states} hidden={false} karaokeMode />
				)}

				{memoryDone && (
					<div className="mt-6 animate-fade-in rounded-2xl bg-emerald-500/10 p-4 text-emerald-300">
						✓ Excellent! You recited the full answer.
					</div>
				)}

				{!recording && !memoryDone &&
					<button onClick={triggerTranscription} disabled={!sttReady}
									className="rounded-lg bg-emerald-600 px-3 py-4 mt-4 text-xs hover:bg-emerald-500 w-full disabled:opacity-40">
								{t(language, "startRecording")}
					</button>
				}
			</div>

			<LiveTranscript text={transcript.slice(-500)} isStop={!recording} />

			<div className="flex gap-3">
				{memoryDone ? (
					<button onClick={onFinished} disabled={grading}
						className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-4 font-semibold transition hover:brightness-110 disabled:opacity-50">
						{grading ? "Scoring…" : activeQuestion < questions.length - 1 ? t(language, "nextQuestion") : "Finish & See Results"}
					</button>
				) : (
					<div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/40 py-4 text-center text-slate-400">
						{allGreen ? "🎤 Now say the full answer from memory…" : "🎤 Read the answer aloud — words turn green as you nail them."}
					</div>
				)}
				{!memoryDone && <button onClick={onFinished} disabled={grading}
					className="rounded-2xl border border-slate-700 px-5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">
					{grading ? t(language, "scoring") : t(language, "skipQuestion")}
				</button>}
			</div>
		</>
  );
}