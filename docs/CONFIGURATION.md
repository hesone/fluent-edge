# Configuration reference

Every axis — LLM, speech-to-text, speech-to-speech — can be set independently of
`NEXT_PUBLIC_APP_MODE`. This is the full picture; the README covers the two common presets.

[← back to the README](../README.md)

---

## Mixing modes

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

## Company research (optional)

The Story Bank page has a **Search the web** button that researches the hiring company and writes
a short profile the story evaluator uses. How it searches depends on the LLM provider:

| LLM provider | How it searches | Needs |
|---|---|---|
| OpenRouter (online) | The model searches the web itself through OpenRouter's `web` plugin, and cites its sources | Credits on your OpenRouter account — about $0.007 per lookup, charged even with free models |
| Ollama (local) | 4 [Tavily](https://tavily.com) searches, then Ollama summarises them | `TAVILY_API_KEY` — free plan, 1,000 credits/month, no card |

Without what your mode needs, the button explains what's missing; you can still type the profile yourself.
Searching sends the **company name** (and nothing about you) to the search service — see [Privacy](PRIVACY.md).
