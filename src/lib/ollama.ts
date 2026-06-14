const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

export async function ollamaGenerate(prompt: string, opts?: { json?: boolean }): Promise<string> {
  console.log("Ollama model:", MODEL);
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      ...(opts?.json ? { format: "json" } : {}),
      options: { temperature: 0.4, num_ctx: 4096 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.response as string;
}

// Robust JSON extraction (LLMs sometimes wrap output)
export function safeJSON<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* noop */ }
    }
    return fallback;
  }
}