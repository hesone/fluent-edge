# FluentEdge — Local AI English Improvement App

Practice **interview** & **professional communication** in English, German, French,
Spanish, or Farsi (RTL). 100% local AI — no external APIs.

- **LLM:** Ollama (`llama3.2:3b`) — question generation + grammar grading
- **STT:** Whisper.cpp via local WebSocket (real-time)
- **Face/Emotion:** MediaPipe FaceLandmarker — confidence, nervousness, engagement, eye contact
- **State:** Zustand (persisted)

---

## 1. Prerequisites
- Node.js ≥ 20
- A webcam + microphone
- ~4 GB free RAM for the model

---

## 2. Install Ollama + model
```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh
# Windows: download from https://ollama.com/download

ollama serve            # starts API on http://localhost:11434
ollama pull llama3.2:3b # download the model
```
Verify:
```bash
curl http://localhost:11434/api/tags
```

---

## 3. Build Whisper.cpp + run the WS bridge
```bash
# Clone & build whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make                                   # builds ./main
bash ./models/download-ggml-model.sh base.en   # downloads ggml-base.en.bin
cd ..

# Point the bridge at your binary + model, then run it:
WHISPER_BIN=./whisper.cpp/main \
WHISPER_MODEL=./whisper.cpp/models/ggml-base.en.bin \
PORT=9090 \
npm run whisper
```
You should see: `🎤 Whisper WS server on ws://localhost:9090`

> Tip: For multilingual practice (German/French/Spanish/Farsi), download a
> multilingual model instead: `bash ./models/download-ggml-model.sh base`
> and remove `.en` from the model path.

---

## 4. Run the web app
```bash
npm install
npm run dev
# open http://localhost:3000
```

Optional env (`.env.local`):
```
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

---

## 5. How it works

### Flow
1. **Onboarding** → upload PDF resume (parsed via `pdf-parse`), pick language/mode/seniority
   → Ollama generates **10 Q&A pairs**.
2. **Study** → read each ideal answer, click *"I'm ready"*.
3. **Practice** →
   - Camera + mic start; MediaPipe runs each frame → **live confidence gauge**.
   - Whisper streams transcript → words matched against ideal answer.
   - Correct word → **green span**; wrong → **red span**.
   - All green → ideal answer hides → **karaoke memory phase** (words appear as you say them).
   - Full recall → **Next Question** unlocks. *Show hint* re-reveals the answer.
4. **Results** → per-question Face / Grammar / Combined scores + video thumbnail.
   - Click a card → **replay with score overlay**.
   - *Practice again* → re-runs that question.
   - 100/100 face **and** grammar on a card → **confetti**.
   - All questions 100/100 → **full-page confetti** + congrats.

### Scoring
- **Face confidence** (`src/lib/faceScoring.ts`): eye-contact (iris centering),
  eyebrow raise (engagement), mouth tension, head stability — EMA-smoothed, averaged over the session.
- **Pronunciation** (`src/lib/pronunciation.ts`): sequential Levenshtein word matching of Whisper output vs expected words.
- **Grammar** (`/api/grade`): Ollama returns
  `{ score, feedback, seniority_match }`.
- **Combined** = average(face, grammar).

---

## 6. Notes & troubleshooting
- **No transcript?** Ensure the Whisper WS server is running on `:9090`. Face scoring works without it.
- **Questions fail to generate?** Confirm `ollama serve` is up and the model is pulled.
- **HTTPS for camera:** `localhost` is treated as secure, so `getUserMedia` works in dev.
- **RTL:** selecting **فارسی** sets `dir="rtl"` across all screens and mirrors layout.
- Recordings use `MediaRecorder` (WebM) and are kept as in-memory object URLs (not persisted across full reloads).

---

## Architecture map
| Concern | File |
|---|---|
| Onboarding UI | `src/app/page.tsx` |
| Study | `src/app/study/page.tsx` |
| Practice (camera/STT/FaceMesh) | `src/app/practice/page.tsx` |
| Results + replay + confetti | `src/app/results/page.tsx` |
| Resume parse | `src/app/api/parse-resume/route.ts` |
| Question gen | `src/app/api/generate-questions/route.ts` |
| Grammar grade | `src/app/api/grade/route.ts` |
| Face scoring | `src/lib/faceScoring.ts` |
| Pronunciation matching | `src/lib/pronunciation.ts` |
| Whisper client | `src/lib/whisperClient.ts` |
| Whisper server | `whisper-server/server.js` |
| State | `src/store/useSessionStore.ts` |