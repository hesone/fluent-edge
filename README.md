# FluentEdge — AI Language Practice App

Practice **general communication**, **interview** & **professional communication** in English, German,
French, Spanish, or Farsi (RTL). Speech recognition and synthesis run **in the browser**, and the LLM
runs on **OpenRouter** — so there's nothing heavy to install and the whole app deploys as a single
Next.js service.

- **LLM:** OpenRouter via the Vercel AI SDK — question generation + grammar grading
- **STT:** Web Speech API (`SpeechRecognition`) — real-time, in-browser
- **TTS:** Web Speech API (`speechSynthesis`) — reads answers aloud with word-by-word highlighting
- **Face/Emotion:** MediaPipe FaceLandmarker — confidence, nervousness, engagement, eye contact
- **State:** Zustand (persisted)

> **Browser support:** the speech features use the Web Speech API, which is reliable in
> **Chrome and Edge**. Firefox has no speech recognition; Safari support is partial. Use a
> Chromium browser for the full experience.

---

## 1. Prerequisites
- Node.js ≥ 20
- A Chromium browser (Chrome / Edge) with a webcam + microphone
- An **OpenRouter API key** — free to create at <https://openrouter.ai/keys>

---

## 2. Configure environment

Create `.env.local` in the project root:

```
# OpenRouter (LLM provider) — get a key at https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-...
# Optional: any model id from https://openrouter.ai/models (defaults to a free model)
OPENROUTER_MODEL=openai/gpt-oss-120b:free
```

`.env.local` is gitignored — never commit your key.

> **Free models** have per-day rate limits and vary in how reliably they return strict JSON.
> If question generation or grading fails intermittently, switch `OPENROUTER_MODEL` to a more
> capable (or paid) model.

---

## 3. Run the web app
```bash
npm install
npm run dev
# open http://localhost:3000 in Chrome or Edge
```

That's it — no separate speech server, no model downloads, no local LLM runtime.

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
  `en-US`, `de-DE`, `fr-FR`, `es-ES`, `fa-IR` — shared by both STT and TTS.
- **Voice selection (TTS):** `VOICE_PREFERENCES` in `src/lib/ttsClient.ts` lists preferred voice
  names per language. To see what your machine offers, run in the browser console:
  `speechSynthesis.getVoices().forEach(v => console.log(v.name, v.lang, v.localService))`,
  then put the name you want first.
- **Word highlighting** is driven by real `onboundary` events when a voice provides them
  (exact sync). Voices that don't emit boundaries (e.g. Chrome's network voices) fall back to a
  self-calibrating time estimate that tightens up after the first utterance and is near-exact on
  replay of the same text.

### Scoring
- **Face confidence** (`src/lib/faceScoring.ts`): eye-contact (iris centering),
  eyebrow raise (engagement), mouth tension, head stability — EMA-smoothed, averaged over the session.
- **Pronunciation** (`src/lib/pronunciation.ts`): sequential Levenshtein word matching of the
  recognized transcript vs expected words.
- **Grammar** (`/api/grade`): OpenRouter returns `{ score, feedback, seniority_match }`.
- **Combined** = average(face, grammar).

---

## 6. Notes & troubleshooting
- **No transcript / "speech recognition not supported"?** Use Chrome or Edge — Firefox has no
  `SpeechRecognition`. Face scoring still works in any browser.
- **No speech on "Volume Icon"?** Your device may not have a voice installed for the selected
  language (notably Farsi). Check available voices with the console snippet above and set a
  preferred voice in `src/lib/ttsClient.ts`.
- **Questions/grading fail?** Confirm `OPENROUTER_API_KEY` is set, and that the chosen
  `OPENROUTER_MODEL` is available and not rate-limited. Free models can throttle.
- **HTTPS for camera:** `localhost` is treated as secure in dev; in production you need HTTPS
  (Render provides it automatically).
- **RTL:** selecting **فارسی** sets `dir="rtl"` across all screens and mirrors layout.
- Recordings use `MediaRecorder` (WebM) and are kept as in-memory object URLs (not persisted across full reloads).

---

## Architecture map
| Concern | File |
|---|---|
| Onboarding UI | `src/app/page.tsx` |
| Study | `src/app/study/page.tsx` |
| Practice (camera/STT/FaceMesh) | `src/app/practice/[slug]/page.tsx` |
| Results + replay + confetti | `src/app/results/page.tsx` |
| Resume parse | `src/app/api/parse-resume/route.ts` |
| Question gen | `src/app/api/generate-questions/route.ts` |
| Answer gen | `src/app/api/generate-answer/route.ts` |
| Grammar grade | `src/app/api/grade/route.ts` |
| LLM provider (OpenRouter) | `src/lib/llm.ts` |
| Face scoring | `src/lib/faceScoring.ts` |
| Pronunciation matching | `src/lib/pronunciation.ts` |
| Speech recognition client (STT) | `src/lib/sttClient.ts` |
| Speech synthesis client (TTS) | `src/lib/ttsClient.ts` |
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