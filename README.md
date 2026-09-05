# FluentEdge — AI Language Practice App

Practice **general communication**, **interview** & **professional communication** in English, German,
French, Spanish, or Farsi (RTL).

FluentEdge runs in **two modes from one codebase**, chosen by configuration:

| | **online** (default) | **local** |
|---|---|---|
| **LLM** | OpenRouter via the Vercel AI SDK | Ollama on your machine |
| **STT** | Web Speech API (`SpeechRecognition`) | whisper.cpp, streamed to the bundled media server |
| **TTS** | Web Speech API (`speechSynthesis`) | Piper voices, via the same media server |
| **Needs** | an API key + internet | whisper.cpp, Piper and Ollama installed |
| **Deploys as** | a single Next.js service | runs entirely offline on your own hardware |

Everything else is shared: **Face/Emotion** via MediaPipe FaceLandmarker (confidence, nervousness,
engagement, eye contact) and persisted **Zustand** state.

The three axes are independent — you can run the LLM locally on Ollama while still using browser
speech, or the reverse. See [§2 Configure environment](#2-configure-environment).

> **Browser support:** in online mode the speech features use the Web Speech API, which is reliable
> in **Chrome and Edge**. Firefox has no speech recognition; Safari support is partial. Local mode
> streams audio over a WebSocket instead and works in any modern browser.

---

## 1. Prerequisites

Always:
- Node.js ≥ 20
- A browser with a webcam + microphone

For **online** mode:
- A Chromium browser (Chrome / Edge) — for the Web Speech API
- An **OpenRouter API key** — free to create at <https://openrouter.ai/keys>

For **local** mode:
- [**Ollama**](https://ollama.com) running, with a model pulled: `ollama pull llama3.2`
- [**whisper.cpp**](https://github.com/ggerganov/whisper.cpp) built, with a model downloaded
- [**Piper**](https://github.com/rhasspy/piper) on your `PATH`, with a voice per language you use
  (defaults are the `-medium` voices — see `media-server/tts-engine.js`)

---

## 2. Configure environment

Copy `.env.example` to `.env.local` and fill in what your mode needs. `.env.local` is gitignored —
never commit your key.

**Online (default)** — nothing to install:

```
NEXT_PUBLIC_APP_MODE=online
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-oss-120b:free
```

**Local** — fully offline:

```
NEXT_PUBLIC_APP_MODE=local
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:latest
NEXT_PUBLIC_MEDIA_WS_URL=ws://localhost:9090
```

### Mixing modes

`NEXT_PUBLIC_APP_MODE` is only the default. Each axis can be overridden on its own, and `auto`
probes the local endpoint at startup and falls back to the online provider if it isn't answering:

| Variable | Values | Axis |
|---|---|---|
| `NEXT_PUBLIC_STT_PROVIDER` | `web` \| `whisper` \| `auto` | speech recognition |
| `NEXT_PUBLIC_TTS_PROVIDER` | `web` \| `piper` \| `auto` | speech synthesis |
| `LLM_PROVIDER` | `openrouter` \| `ollama` \| `auto` | question gen + grading |

Leave one empty to follow `NEXT_PUBLIC_APP_MODE`. So a local LLM with browser speech is just
`LLM_PROVIDER=ollama` on top of the online defaults.

Resolution happens in `src/lib/config.ts` (client-visible axes) and `src/lib/config.server.ts`
(the LLM, kept server-side so no host or key path reaches the browser bundle). The media-server
probe runs **once per page load** and is memoised, so `auto` costs one WebSocket open, not one
per component.

> **Free OpenRouter models** have per-day rate limits and vary in how reliably they return strict
> JSON. If question generation or grading fails intermittently, switch `OPENROUTER_MODEL` to a more
> capable (or paid) model. Ollama gets an explicit `format: "json"` nudge for the same reason.

---

## 3. Run the web app

**Online mode** — one process:

```bash
npm install
npm run dev
# open http://localhost:3000 in Chrome or Edge
```

That's it — no separate speech server, no model downloads, no local LLM runtime.

**Local mode** — two processes, plus Ollama:

```bash
npm install
npm run media     # whisper.cpp STT + Piper TTS over ws://localhost:9090
npm run dev       # in a second terminal
```

The media server serves both speech axes over one WebSocket. If it isn't running, the app says so
in the practice screen rather than failing silently.

---

## 4. Deploy to Render (free tier)

The app is a standard Next.js web service with no persistent background process, so it runs on
Render's **free web service** at zero cost.

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Environment variables:** `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`)

Notes:
- Render serves over HTTPS on `*.onrender.com`, which is required for microphone/camera access.
- Free services **spin down after ~15 min idle** and cold-start (~30–60 s) on the next request.
- The long-running `generate-questions` route (`maxDuration = 120`) runs fine on Render since a
  web service has no per-request timeout.

---

## 5. How it works

### Flow
1. **Onboarding** → upload PDF resume (parsed via `pdf-parse`), pick language/mode/seniority
   → OpenRouter generates **10 Q&A pairs**.
   - **Preferred Q&A (optional):** below the General/Workspace selector you can add up to **10 of
     your own question/answer pairs** (answers optional). The AI rewrites them into the practice
     language at your CEFR level (General) or seniority/mode register (Workspace), writes missing
     answers, and generates related questions to fill the session up to 10. Each tab (General /
     Workspace) keeps its own persisted list and settings across reloads.
2. **Study** → read each ideal answer, optionally click the **Volume Icon** to hear it spoken
   (browser `speechSynthesis`), with each word highlighted in sync as it's spoken
   → click *"I'm ready"*.
3. **Practice** →
   - Camera + mic start; MediaPipe runs each frame → **live confidence gauge**.
   - Browser speech recognition streams a transcript → words matched against the ideal answer.
   - Correct word → **green span**; wrong → **red span**.
   - All green → ideal answer hides → **karaoke memory phase** (words appear as you say them).
   - Full recall → **Next Question** unlocks. *Show hint* re-reveals the answer.
4. **Results** → per-question Face / Grammar / Combined scores + video thumbnail.
   - Click a card → **replay with score overlay**.
   - *Practice again* → re-runs that question.
   - 100/100 face **and** grammar on a card → **confetti**.
   - All questions 100/100 → **full-page confetti** + congrats.

### Speech details
- **Languages** map to unique BCP-47 codes in one place (`LOCALE` in `src/lib/i18n.ts`):
  `en-US`, `de-DE`, `fr-FR`, `es-ES`, `fa-IR`. The Web Speech adapters use these; the whisper.cpp
  adapter deliberately passes the plain ISO-639-1 code instead, which is what whisper expects.
- **Voice selection (online TTS):** `VOICE_PREFERENCES` in `src/lib/tts/webSpeech.ts` lists
  preferred voice names per language. To see what your machine offers, run in the browser console:
  `speechSynthesis.getVoices().forEach(v => console.log(v.name, v.lang, v.localService))`,
  then put the name you want first.
- **Voice selection (local TTS):** `PIPER_VOICE_MAP` in `media-server/tts-engine.js`, overridable
  per language with `PIPER_VOICE_EN`, `PIPER_VOICE_FA`, … If you switch to `-low` / `-x_low`
  voices, update `TTS_SAMPLE_RATE` in that file to `16000` to match — the server announces the rate
  to the client in the `tts_audio` header, so the two never have to guess at each other.
- **Word highlighting** uses the best signal each engine offers, in this order:
  1. **Real boundary events** (`onboundary`) — exact; most desktop Web Speech voices emit these.
  2. **A known duration + the audio clock** — exact; Piper hands back a finished PCM buffer, so
     playback is interpolated against the very `AudioContext` clock it was scheduled on.
  3. **A self-calibrating estimate** — for voices that report neither (e.g. Chrome's network
     voices). It tightens after the first utterance and is near-exact on replay of the same text.

  Words skipped by a slow frame are queued and flashed one at a time rather than collapsed into
  their successor, so the bounce animation never silently drops a word.

### Scoring
- **Face confidence** (`src/lib/faceScoring.ts`): eye-contact (iris centering),
  eyebrow raise (engagement), mouth tension, head stability — EMA-smoothed, averaged over the session.
- **Pronunciation** (`src/lib/pronunciation.ts`): sequential Levenshtein word matching of the
  recognized transcript vs expected words.
- **Grammar** (`/api/grade`): the configured LLM (OpenRouter or Ollama) returns
  `{ score, feedback, seniority_match }`.
- **Combined** = average(face, grammar).

---

## 6. Notes & troubleshooting
- **No transcript / "speech recognition not supported"?** In online mode, use Chrome or Edge —
  Firefox has no `SpeechRecognition`. Face scoring still works in any browser.
- **"Can't reach the local media server"?** In local mode, start it with `npm run media` and check
  `NEXT_PUBLIC_MEDIA_WS_URL`. The badge above the answer reads **local** or **online** so you can
  see which provider actually resolved.
- **No speech on "Volume Icon"?** Online: your device may not have a voice installed for the
  selected language (notably Farsi) — check available voices with the console snippet above and set
  a preferred voice in `src/lib/tts/webSpeech.ts`. Local: check that the Piper voice file for that
  language exists in `PIPER_VOICES_DIR`.
- **Local speech sounds fast and high-pitched?** The Piper voice's sample rate doesn't match
  `TTS_SAMPLE_RATE` in `media-server/tts-engine.js` — `-medium` voices are 22050 Hz, `-low` and
  `-x_low` are 16000 Hz.
- **Questions/grading fail?** Online: confirm `OPENROUTER_API_KEY` is set and the chosen
  `OPENROUTER_MODEL` is available and not rate-limited — free models throttle. Local: confirm
  `ollama serve` is running and `OLLAMA_MODEL` has been pulled. The error message names whichever
  backend it was actually talking to.
- **HTTPS for camera:** `localhost` is treated as secure in dev; in production you need HTTPS
  (Render provides it automatically).
- **RTL:** selecting **فارسی** sets `dir="rtl"` across all screens and mirrors layout.
- Recordings use `MediaRecorder` (WebM) and are kept as in-memory object URLs (not persisted across full reloads).

---

## Architecture map
| Concern | File |
|---|---|
| Onboarding UI | `src/app/page.tsx` |
| Preferred Q&A editor | `src/components/PreferredQA.tsx` |
| Study | `src/app/study/page.tsx` |
| Practice (camera/STT/FaceMesh) | `src/app/practice/[slug]/page.tsx` |
| Results + replay + confetti | `src/app/results/page.tsx` |
| Resume parse | `src/app/api/parse-resume/route.ts` |
| Question gen | `src/app/api/generate-questions/route.ts` |
| Answer gen | `src/app/api/generate-answer/route.ts` |
| Grammar grade | `src/app/api/grade/route.ts` |
| Mode config (client axes) | `src/lib/config.ts` |
| Mode config (LLM, server-only) | `src/lib/config.server.ts` |
| LLM provider (OpenRouter / Ollama) | `src/lib/llm.ts` |
| Face scoring | `src/lib/faceScoring.ts` |
| Pronunciation matching | `src/lib/pronunciation.ts` |
| STT contract + factory | `src/lib/stt/types.ts`, `src/lib/stt/index.ts` |
| STT — online / local | `src/lib/stt/webSpeech.ts`, `src/lib/stt/whisper.ts` |
| TTS contract + factory | `src/lib/tts/types.ts`, `src/lib/tts/index.ts` |
| TTS — online / local | `src/lib/tts/webSpeech.ts`, `src/lib/tts/piper.ts` |
| Local media server (STT + TTS) | `media-server/server.js` |
| Locale / i18n | `src/lib/i18n.ts` |
| State | `src/store/useSessionStore.ts` |

---

## License

FluentEdge's **source code** is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

> This license covers only the source code in this repository. It does **not** cover third-party
> libraries or services that you use with it. See the section below for their individual terms.

---

## Third-Party Software Licenses

FluentEdge relies on the following open-source projects and services. Each is distributed under its
own license; you are responsible for reviewing and complying with them, especially before any
redistribution or commercial use.

| Package / Service | License | Notes |
|---|---|---|
| [OpenRouter](https://openrouter.ai/) | Service (see terms) | Hosted LLM API — usage governed by OpenRouter's terms and each model's license |
| [@openrouter/ai-sdk-provider](https://github.com/OpenRouterTeam/ai-sdk-provider) | Apache 2.0 | OpenRouter provider for the Vercel AI SDK |
| [Vercel AI SDK](https://github.com/vercel/ai/blob/main/LICENSE) | Apache 2.0 | LLM orchestration |
| [MediaPipe](https://github.com/google-ai-edge/mediapipe) | Apache 2.0 | Face landmark detection |
| [Next.js](https://github.com/vercel/next.js/blob/canary/LICENSE) | MIT | Web framework |
| [React](https://github.com/facebook/react/blob/main/LICENSE) | MIT | UI library |
| [Zustand](https://github.com/pmndrs/zustand/blob/main/LICENSE) | MIT | State management |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE) | MIT | Utility-first CSS framework |
| [PDF Parse](https://github.com/mehmet-kozan/pdf-parse/blob/main/LICENSE) | Apache 2.0 | Resume PDF text extraction |
| [Zod](https://github.com/colinhacks/zod/blob/main/LICENSE) | MIT | Schema validation |

> **Speech APIs:** Speech recognition and synthesis use the browser's built-in **Web Speech API**.
> No model or library is bundled for this — behaviour and voices depend on the user's browser/OS.
>
> **Apache 2.0 note:** If you redistribute a binary that includes MediaPipe (or other Apache-2.0
> components), Apache 2.0 requires you to include a copy of the license and any applicable NOTICE file.

---

## Contributing

Contributions are welcome via pull request. By submitting a PR, you certify that:

1. Your contribution is your own original work, or you have the right to submit it.
2. You license your contribution under the same MIT License that covers this project (in line with the [Developer Certificate of Origin v1.1](https://developercertificate.org/)).

---

## Privacy

Unlike earlier local-only versions, FluentEdge now relies on **external services** for speech and
language processing. Be aware of what leaves the user's device:

- **Audio (microphone):** processed by the browser's Web Speech API. In Chrome/Edge, recognition is
  performed by the browser vendor's cloud service (audio is sent to their servers), not locally.
- **Synthesized speech (read-aloud):** generated by the browser/OS via `speechSynthesis`. Depending
  on the chosen voice, this may use an on-device or a network voice.
- **Resume + answer text:** sent to **OpenRouter** (and the selected model provider) for question
  generation and grammar grading.
- **Preferred Q&A:** user-entered questions/answers are stored in browser `localStorage` (Zustand
  persist) and sent to **OpenRouter** when generating a session.
- **Video (webcam frames):** processed **locally** by MediaPipe and never transmitted.
- **Session recordings:** stored as in-memory object URLs in the browser and cleared on page reload.
- **No first-party analytics, telemetry, or tracking** is included in this codebase.

> **Your responsibility:** Review the privacy terms of OpenRouter, your selected model provider, and
> your browser's speech services. If you deploy this app for others, you are responsible for
> disclosing this data flow and complying with applicable regulations.

### GDPR / Data Protection Notice (EU users)

FluentEdge processes **biometric-adjacent data** (facial landmarks, locally) and **sensitive personal
data** (resume content and transcribed speech, which is sent to third-party services). If you deploy
this application for use by others, you may have data-processing obligations toward those third
parties and your users. Please consult a legal professional if in doubt.

---

## Disclaimer

The language, pronunciation, grammar, and confidence scores generated by this application are
AI-assisted estimates provided for **educational and practice purposes only**. They do not
constitute professional assessment and should not be relied upon for formal evaluation, hiring
decisions, or language certification. Accuracy may vary depending on your hardware, microphone
quality, ambient noise, browser, and the limitations of the underlying models.