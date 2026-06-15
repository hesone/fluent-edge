import { t } from "@/lib/i18n";
import { matchTranscript, pronunciationScore, WordState } from "@/lib/pronunciation";
import { WhisperStream } from "@/lib/whisperClient";
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

const treshold = 0.9;  // how much of the answer must be correct to move to memory phase

export default function Transcription({ activeQuestion, setError, transcriptFinished, stream, triggerRecording }: TranscriptionProps) {
  const whisperRef = useRef<WhisperStream | null>(null);
	const transcriptRef = useRef("");

	const {
		questions, language, seniority,
	} = useSessionStore();

	const q = questions[activeQuestion];
	const words = q ? q.idealAnswer.replace(/[,!?;:"()\[\]{}]/g, " ").split(/\s+/).filter(Boolean) : [];

	const [transcript, setTranscript] = useState("");
	const [states, setStates] = useState<WordState[]>(words.map(() => "pending"));
	const [allGreen, setAllGreen] = useState(false);  // first phase done
	const [memoryDone, setMemoryDone] = useState(false);
	const [showHint, setShowHint] = useState(false);
	const [grading, setGrading] = useState(false);

	const isConnected = whisperRef.current?.connected() ?? false;
	let tryCounter = 0

	useEffect(() => {
		if(!!stream) {
			return;
		}

		(async () => {
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
				// await whisperRef.current.start(stream);
				tryCounter = 0
			} catch (we) {
				console.warn("Whisper unavailable", we);
				if(tryCounter === 1)
					setError("Whisper WebSocket not connected — start the whisper server (see README). Face scoring still works.");

				tryCounter = tryCounter+1;
			}
		})();  // avoid "Async function in useEffect" lint error

		return () => {
			whisperRef.current?.stop();
		}
	}, [stream]);

	function triggerTranscription() {
		if (whisperRef.current) {
			triggerRecording();
			if(isConnected)	{
				whisperRef.current.stop();
			} else {
				whisperRef.current.start(stream!);
			}
		}
	}

	function resetTranscript() {
		transcriptRef.current = "";
		setTranscript("");
		setStates(words.map(() => "pending"));
	}

	useEffect(() => {
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
    setGrading(true);
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
						{allGreen && !memoryDone && (
							<button onClick={() => setShowHint((s) => !s)}
								className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700">
								{showHint ? "Hide hint" : t(language, "showHint")}
							</button>
						)}
						
						{isConnected &&
							<button onClick={triggerTranscription}
											className="rounded-lg bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700 border-rose-500 border">
								{isConnected ? t(language, "stopRecording") : t(language, "startRecording")}
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

				{!isConnected &&
					<button onClick={triggerTranscription}
									className="rounded-lg bg-emerald-600 px-3 py-4 mt-4 text-xs hover:bg-emerald-500 w-full">
								{t(language, "startRecording")}
					</button>
				}
			</div>

			<LiveTranscript text={transcript.slice(-500)} isStop={!isConnected} />

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
				<button onClick={onFinished} disabled={grading}
					className="rounded-2xl border border-slate-700 px-5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">
					{grading ? t(language, "scoring") : t(language, "skipQuestion")}
				</button>
			</div>
		</>
  );
}