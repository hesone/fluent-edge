// LLM provider — one seam, two backends.
//
//   online → OpenRouter (OpenAI-compatible) — needs OPENROUTER_API_KEY
//   local  → Ollama on your own machine     — needs `ollama serve` + a pulled model
//
// Which one is used comes from src/lib/config.ts (LLM_PROVIDER, else APP_MODE).
// Server-side only: this module reads secrets, so never import it into a
// client component.
//
// Note: free OpenRouter models have request rate limits and vary in how
// reliably they honour structured/JSON output. If grading or question
// generation ever returns malformed JSON, switch OPENROUTER_MODEL to a paid
// model. Ollama needs an explicit format:"json" nudge for the same reason —
// that is what `providerOptions` below carries.

import type { LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ai-sdk-ollama";
import {
  OLLAMA_MODEL,
  OLLAMA_URL,
  OPENROUTER_MODEL,
  resolveLLMProvider,
  type LLMProvider,
} from "./config.server";

export interface LLMHandle {
  provider: LLMProvider;
  /** Model id in use — handy for logs and error messages. */
  modelId: string;
  model: LanguageModel;
  /**
   * Extra options to spread into generateText / streamText. Ollama needs
   * format:"json" for structured output; OpenRouter needs nothing.
   */
  providerOptions?: Record<string, Record<string, string>>;
}

let cached: LLMHandle | null = null;

/** Resolve the configured LLM once per server process. */
export async function getLLM(): Promise<LLMHandle> {
  if (cached) return cached;

  const provider = await resolveLLMProvider();

  if (provider === "ollama") {
    const ollama = createOllama({ baseURL: OLLAMA_URL });
    cached = {
      provider,
      modelId: OLLAMA_MODEL,
      model: ollama(OLLAMA_MODEL) as LanguageModel,
      providerOptions: { ollama: { format: "json" } },
    };
    return cached;
  }

  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local, or run locally " +
        "with NEXT_PUBLIC_APP_MODE=local (or LLM_PROVIDER=ollama)."
    );
  }

  const openrouter = createOpenRouter({ apiKey });
  cached = {
    provider,
    modelId: OPENROUTER_MODEL,
    model: openrouter.chat(OPENROUTER_MODEL) as LanguageModel,
  };
  return cached;
}

/**
 * Human-readable name of whatever is serving requests, for error copy that
 * tells the user which thing to go start.
 */
export async function llmLabel(): Promise<string> {
  const { provider, modelId } = await getLLM();
  return provider === "ollama" ? `Ollama (${modelId})` : `OpenRouter (${modelId})`;
}

/**
 * A model that can search the web by itself — OpenRouter's `web` plugin.
 * Returns null for Ollama, which has no built-in search (the company-research
 * route falls back to Tavily there). Web search is billed by OpenRouter per
 * request (about $0.007 with the default engine), even with free models.
 */
export async function getWebSearchModel(maxResults = 8): Promise<LanguageModel | null> {
  const { provider } = await getLLM();
  if (provider !== "openrouter") return null;
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY ?? "" });
  return openrouter.chat(OPENROUTER_MODEL, {
    plugins: [{ id: "web", max_results: maxResults }],
  }) as LanguageModel;
}
