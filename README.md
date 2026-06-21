# FluentEdge — Local AI English Improvement App

Practice **general communication**, **interview** & **professional communication** in English, German, French,
Spanish, or Farsi (RTL). 100% local AI — no external APIs.

- **LLM:** Ollama (`llama3.2:3b`) — question generation + grammar grading
- **STT:** Whisper.cpp via local WebSocket (real-time)
- **TTS:** Piper via local WebSocket — reads answers aloud with word-by-word highlighting
- **Face/Emotion:** MediaPipe FaceLandmarker — confidence, nervousness, engagement, eye contact
- **State:** Zustand (persisted)

---

## 1. Prerequisites
- Node.js ≥ 20
- Python 3 (for Piper TTS)
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

## 3. Build Whisper.cpp + install Piper

The STT and TTS engines are served by **one combined WebSocket bridge** on
`ws://localhost:9090` — `media-server/server.js`. It dispatches by message
shape: raw binary frames are mic audio routed to Whisper, `{ type: "tts", ... }`
requests are routed to Piper.

```bash
# Clone & build whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
cmake -B build && cmake --build build --config Release   # builds ./build/bin/whisper-cli
bash ./models/download-ggml-model.sh base.en              # downloads ggml-base.en.bin
cd ..

# Install Piper (TTS)
pip install piper-tts

# Download a voice per language you want to support
mkdir -p media-server/piper-voices
piper --download-dir media-server/piper-voices --update-voices --voice en_US-lessac-medium
piper --download-dir media-server/piper-voices --update-voices --voice de_DE-thorsten-medium
piper --download-dir media-server/piper-voices --update-voices --voice fr_FR-siwis-medium
piper --download-dir media-server/piper-voices --update-voices --voice es_ES-davefx-medium
piper --download-dir media-server/piper-voices --update-voices --voice fa_IR-ganji-medium
```

> **Farsi voice:** Piper does ship Farsi voices — `fa_IR-ganji-medium` is the one used
> here and works well. A few other community Farsi voices exist too (`amir`,
> `ganji_adabi`, `gyro`, `reza_ibrahim`) — see
> [Piper's voice list](https://github.com/rhasspy/piper/blob/master/VOICES.md) to try one.

Each language's voice filename can be overridden via env var if you download a
different voice than the defaults above:

| Language | Env var | Default filename |
|---|---|---|
| English | `PIPER_VOICE_EN` | `en_US-lessac-medium.onnx` |
| German | `PIPER_VOICE_DE` | `de_DE-thorsten-medium.onnx` |
| French | `PIPER_VOICE_FR` | `fr_FR-siwis-medium.onnx` |
| Spanish | `PIPER_VOICE_ES` | `es_ES-davefx-medium.onnx` |
| Farsi | `PIPER_VOICE_FA` | `fa_IR-ganji-medium.onnx` |

Run the combined media server:
```bash
WHISPER_BIN=./whisper.cpp/build/bin/whisper-cli \
WHISPER_MODEL=./whisper.cpp/models/ggml-base.en.bin \
PIPER_BIN=piper \
PIPER_VOICES_DIR=./media-server/piper-voices \
PORT=9090 \
npm run media
```
You should see: `🎤🔊 Media WS server (STT + TTS) on ws://localhost:9090`

> Tip: For multilingual STT practice (German/French/Spanish/Farsi), download a
> multilingual Whisper model instead: `bash ./models/download-ggml-model.sh base`
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
NEXT_PUBLIC_STTS_URL=ws://localhost:9090
```

---

## 5. How it works

### Flow
1. **Onboarding** → upload PDF resume (parsed via `pdf-parse`), pick language/mode/seniority
   → Ollama generates **10 Q&A pairs**.
2. **Study** → read each ideal answer, optionally click **Volume Icon** to hear the
   ideal answer spoken (Piper), with each word highlighted and bounced in sync as it's
   spoken → click *"I'm ready"*.
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
- **No transcript?** Ensure the media server is running on `:9090`. Face scoring works without it.
- **No speech on "Volume Icon"?** Confirm the media server is running and the Piper
  voice file for the selected language exists in `media-server/piper-voices/`. Check
  the browser console — `ttsClient.ts` surfaces server errors there.
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
| Whisper client (STT) | `src/lib/sttClient.ts` |
| Piper client (TTS) | `src/lib/ttsClient.ts` |
| Combined media server (entry point) | `media-server/server.js` |
| Whisper transcription logic | `media-server/stt-engine.js` |
| Piper synthesis logic | `media-server/tts-engine.js` |
| State | `src/store/useSessionStore.ts` |

---
 
## License
 
FluentEdge's **source code** is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
 
> This license covers only the source code in this repository. It does **not** cover third-party
> models, binaries, or libraries that you install separately. See the sections below for their
> individual terms.
 
---
 
## Third-Party Software Licenses
 
FluentEdge relies on the following open-source projects. Each is distributed under its own license;
you are responsible for reviewing and complying with them, especially before any redistribution or
commercial use.
 
| Package | License | Notes |
|---|---|---|
| [Ollama](https://github.com/ollama/ollama) | MIT | Runtime for local LLM inference |
| [Llama 3.2](https://www.llama.com/llama3_2/license/) | Meta Llama 3.2 Community License | **Not OSI-approved.** Usage restrictions apply — see note in §2 |
| [whisper.cpp](https://github.com/ggerganov/whisper.cpp) | MIT | Local speech-to-text runtime |
| [Whisper model weights](https://github.com/openai/whisper/blob/main/LICENSE) | MIT | OpenAI-trained GGML model files |
| [Piper](https://github.com/rhasspy/piper) | MIT | Local text-to-speech runtime |
| [Piper voice models](https://huggingface.co/rhasspy/piper-voices) | MIT / CC0 (varies by voice — check each voice card) | Neural TTS voice weights |
| [MediaPipe](https://github.com/google-ai-edge/mediapipe) | Apache 2.0 | Face landmark detection |
| [Next.js](https://github.com/vercel/next.js/blob/canary/LICENSE) | MIT | Web framework |
| [React](https://github.com/facebook/react/blob/main/LICENSE) | MIT | UI library |
| [Zustand](https://github.com/pmndrs/zustand/blob/main/LICENSE) | MIT | State management |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE) | MIT | Utility-first CSS framework |
| [PDF Parse](https://github.com/mehmet-kozan/pdf-parse/blob/main/LICENSE) | Apache 2.0 | Resume PDF text extraction |
| [Vercel AI](https://github.com/vercel/ai/blob/main/LICENSE) | Apache 2.0 | Vercel AI SDK |
| [Zod](https://github.com/colinhacks/zod/blob/main/LICENSE) | MIT | Schema Validation |
 
> **Apache 2.0 note:** If you redistribute a binary that includes MediaPipe, Apache 2.0 requires
> you to include a copy of the license and any applicable NOTICE file.
>
> **Piper voices note:** Individual voice models may carry their own license terms separate from
> Piper's MIT license — check each voice's model card on Hugging Face before redistribution.
 
---
 
## Contributing
 
Contributions are welcome via pull request. By submitting a PR, you certify that:
 
1. Your contribution is your own original work, or you have the right to submit it.
2. You license your contribution under the same MIT License that covers this project (in line with the [Developer Certificate of Origin v1.1](https://developercertificate.org/)).

---
 
## Privacy
 
FluentEdge is designed for **fully local operation**. By default:
 
- **Audio** (microphone input) is processed locally by whisper.cpp and is never transmitted externally.
- **Synthesized speech** (answer read-aloud) is generated locally by Piper and is never transmitted externally.
- **Video** (webcam frames) is processed locally by MediaPipe and is never transmitted externally.
- **Resume data** (uploaded PDF) is parsed locally by `pdf-parse` and sent only to your local Ollama instance.
- **Session recordings** are stored as in-memory object URLs in your browser and are cleared on page reload.
- **No analytics, telemetry, or tracking** of any kind is included in this codebase.
> **Your responsibility:** This privacy guarantee applies to the default configuration described in
> this README. If you modify `OLLAMA_URL` to point to a remote server, or deploy this app in a
> non-local environment, data may leave your machine. You are responsible for auditing your own
> deployment configuration.
 
### GDPR / Data Protection Notice (EU users)
 
If you are subject to the GDPR or similar data protection regulations, note that FluentEdge
processes **biometric-adjacent data** (facial landmarks) and potentially **sensitive personal data**
(resume content, voice recordings). In its default local-only configuration, no personal data is
transmitted or stored persistently, which minimises regulatory obligations. However, if you deploy
this application for use by others (e.g. on a shared server), you may have additional legal
obligations. Please consult a legal professional if in doubt.
 
---
 
## Disclaimer
 
The language, pronunciation, grammar, and confidence scores generated by this application are
AI-assisted estimates provided for **educational and practice purposes only**. They do not
constitute professional assessment and should not be relied upon for formal evaluation, hiring
decisions, or language certification. Accuracy may vary depending on your hardware, microphone
quality, ambient noise, and the limitations of the underlying models.