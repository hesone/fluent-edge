// Server-side half of the runtime configuration: the LLM axis.
//
// Kept in its own module so that importing config.ts from a client component
// never drags Ollama/OpenRouter env reads into the browser bundle. Import this
// only from route handlers and other server code.

import { APP_MODE, PROBE_TIMEOUT_MS, read, type LLMProvider } from "./config";

export type { LLMProvider };

const llmSetting = read(process.env.LLM_PROVIDER, ["openrouter", "ollama"] as const);

export const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:latest";
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";

/** Web search for the company-research button (Story Bank). Free key at https://tavily.com */
export const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";

let ollamaProbe: Promise<boolean> | null = null;

async function probeOllama(): Promise<boolean> {
  if (ollamaProbe) return ollamaProbe;
  ollamaProbe = (async () => {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), PROBE_TIMEOUT_MS);
      const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: ctl.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  })();
  return ollamaProbe;
}

export async function resolveLLMProvider(): Promise<LLMProvider> {
  if (llmSetting === "auto") return (await probeOllama()) ? "ollama" : "openrouter";
  if (llmSetting) return llmSetting;
  return APP_MODE === "local" ? "ollama" : "openrouter";
}
