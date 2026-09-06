# Troubleshooting

Symptoms and their usual causes, for both modes.

[← back to the README](../README.md)

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
