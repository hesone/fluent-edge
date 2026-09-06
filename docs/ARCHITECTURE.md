# How FluentEdge works

The session flow, the speech pipeline, how scores are produced, and where each concern lives in the tree.

[← back to the README](../README.md)

## Flow
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

## Speech details
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

## Scoring
- **Face confidence** (`src/lib/faceScoring.ts`): eye-contact (iris centering),
  eyebrow raise (engagement), mouth tension, head stability — EMA-smoothed, averaged over the session.
- **Pronunciation** (`src/lib/pronunciation.ts`): sequential Levenshtein word matching of the
  recognized transcript vs expected words.
- **Grammar** (`/api/grade`): the configured LLM (OpenRouter or Ollama) returns
  `{ score, feedback, seniority_match }`.
- **Combined** = average(face, grammar).

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
