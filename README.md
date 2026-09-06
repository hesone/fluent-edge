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
| **Deploys as** | a single Next.js service | runs on your own hardware — offline apart from the MediaPipe assets ([details](docs/THIRD_PARTY.md#third-party-assets-fetched-at-runtime)) |

Everything else is shared: **Face/Emotion** via MediaPipe FaceLandmarker (confidence, nervousness,
engagement, eye contact) and persisted **Zustand** state.

> **Browser support:** in online mode the speech features use the Web Speech API, which is reliable
> in **Chrome and Edge**. Firefox has no speech recognition; Safari support is partial. Local mode
> streams audio over a WebSocket instead and works in any modern browser.

---

## Prerequisites

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

## Configure

Copy `.env.example` to `.env.local` and fill in what your mode needs. `.env.local` is gitignored —
never commit your key.

**Online (default)** — nothing to install:

```
NEXT_PUBLIC_APP_MODE=online
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-oss-120b:free
```

**Local** — everything on your own machine:

```
NEXT_PUBLIC_APP_MODE=local
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:latest
NEXT_PUBLIC_MEDIA_WS_URL=ws://localhost:9090
```

Each axis can also be set independently of `NEXT_PUBLIC_APP_MODE` — a local LLM with browser
speech, say. See the [configuration reference](docs/CONFIGURATION.md).

---

## Run

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

## Deploy

A standard Next.js web service — `npm install && npm run build`, then `npm start`. Set
`OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`). It needs HTTPS: microphone and camera
access requires a secure context.

---

## Documentation

| | |
|---|---|
| [How it works](docs/ARCHITECTURE.md) | Session flow, speech pipeline, scoring, and where each concern lives |
| [Configuration](docs/CONFIGURATION.md) | Per-axis overrides and how providers resolve |
| [Design system](docs/DESIGN.md) | Tokens, the light/dark themes, and the accessibility commitments |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Symptoms and their usual causes, in both modes |
| [Privacy](docs/PRIVACY.md) | What leaves the device, GDPR notes, and the scoring disclaimer |
| [Licences](docs/THIRD_PARTY.md) | Third-party terms, including the bundled fonts |

---

## Licence

Source code is **MIT** — see [LICENSE](LICENSE).

The bundled typefaces are **not** MIT. They are under the **SIL Open Font License 1.1**, which
requires their licence and copyright notices travel with the files: keep
[`src/fonts/LICENSE.md`](src/fonts/LICENSE.md) next to them if you fork or redistribute. Everything
else third-party is in [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md).
