// Runtime mode configuration — "am I running online, or fully locally?"
//
// FluentEdge has three independent provider axes. Each can follow the master
// APP_MODE, or be pinned individually, or be resolved automatically:
//
//   axis  local            online          env override
//   ────  ───────────────  ──────────────  ─────────────────────────────
//   STT   whisper.cpp WS   Web Speech API  NEXT_PUBLIC_STT_PROVIDER
//   TTS   Piper WS         Web Speech API  NEXT_PUBLIC_TTS_PROVIDER
//   LLM   Ollama           OpenRouter      LLM_PROVIDER  (server-only)
//
// Precedence for each axis:  per-axis override → APP_MODE → "online".
// A per-axis value of "auto" probes the local endpoint and falls back online.
//
// Why NEXT_PUBLIC_ on the mode and the STT/TTS axes: those decisions are made
// in the browser, and Next.js only inlines NEXT_PUBLIC_* into the client
// bundle. LLM_PROVIDER stays server-only so no key or host leaks to the client.
// (process.env.X must be written out literally here — Next inlines by exact
// textual match, so dynamic lookup like process.env[name] would come back
// undefined in the browser.)

export type AppMode = "online" | "local";
export type STTProvider = "web" | "whisper";
export type TTSProvider = "web" | "piper";
export type LLMProvider = "openrouter" | "ollama";
// The LLM axis is resolved server-side only — see ./config.server.ts. Keeping
// its env reads out of this module means no server-only host, model id or key
// path is ever pulled into the client bundle.

export type Setting<T extends string> = T | "auto" | null;

export function read<T extends string>(raw: string | undefined, allowed: readonly T[]): Setting<T> {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;                                    // unset → follow APP_MODE
  if (v === "auto") return "auto";
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** Master switch. Anything other than "local" means online. */
export const APP_MODE: AppMode =
  (process.env.NEXT_PUBLIC_APP_MODE ?? "").trim().toLowerCase() === "local" ? "local" : "online";

/**
 * WebSocket endpoint of the local media server (whisper.cpp STT + Piper TTS).
 * NEXT_PUBLIC_STTS_URL is the legacy name and still works.
 */
export const MEDIA_WS_URL =
  process.env.NEXT_PUBLIC_MEDIA_WS_URL ||
  process.env.NEXT_PUBLIC_STTS_URL ||
  "ws://localhost:9090";

const sttSetting = read(process.env.NEXT_PUBLIC_STT_PROVIDER, ["web", "whisper"] as const);
const ttsSetting = read(process.env.NEXT_PUBLIC_TTS_PROVIDER, ["web", "piper"] as const);

// ─── Local media server probe ────────────────────────────────────────────────
//
// Memoised at module scope: the probe opens one WebSocket the first time an
// "auto" axis needs an answer, and every later caller — including after client
// side navigation — reuses that same promise. One probe per page load, not one
// per component.

export const PROBE_TIMEOUT_MS = 1500;
let mediaProbe: Promise<boolean> | null = null;

export function probeMediaServer(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (mediaProbe) return mediaProbe;

  mediaProbe = new Promise<boolean>((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(MEDIA_WS_URL);
    } catch {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), PROBE_TIMEOUT_MS);

    ws.onopen = () => finish(true);
    ws.onerror = () => finish(false);
    ws.onclose = () => finish(false);
  });

  return mediaProbe;
}

/** Forget the cached probe result — used by the "retry local server" action. */
export function resetMediaProbe() {
  mediaProbe = null;
}

// ─── Axis resolution ─────────────────────────────────────────────────────────

export async function resolveSTTProvider(): Promise<STTProvider> {
  if (sttSetting === "auto") return (await probeMediaServer()) ? "whisper" : "web";
  if (sttSetting) return sttSetting;
  return APP_MODE === "local" ? "whisper" : "web";
}

export async function resolveTTSProvider(): Promise<TTSProvider> {
  if (ttsSetting === "auto") return (await probeMediaServer()) ? "piper" : "web";
  if (ttsSetting) return ttsSetting;
  return APP_MODE === "local" ? "piper" : "web";
}

/**
 * Synchronous best guess, for first render before the probe resolves.
 * "auto" optimistically assumes the configured APP_MODE.
 */
export function presumedSTTProvider(): STTProvider {
  if (sttSetting && sttSetting !== "auto") return sttSetting;
  return APP_MODE === "local" ? "whisper" : "web";
}

export function presumedTTSProvider(): TTSProvider {
  if (ttsSetting && ttsSetting !== "auto") return ttsSetting;
  return APP_MODE === "local" ? "piper" : "web";
}
