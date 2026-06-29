// LLM provider — OpenRouter (OpenAI-compatible) via the Vercel AI SDK.
//
// Replaces the previous local Ollama setup. Configure in .env.local:
//   OPENROUTER_API_KEY=sk-or-...        (required — get one at openrouter.ai/keys)
//   OPENROUTER_MODEL=...                (optional — defaults to a free model)
//
// Note: free models have request rate limits and vary in how reliably they
// honour structured/JSON output. Swap OPENROUTER_MODEL for a paid model if the
// grading / question-generation JSON ever comes back malformed.

import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

export const MODEL_ID = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";

/** Shared chat model used by all API routes. */
export const llm = openrouter.chat(MODEL_ID);
