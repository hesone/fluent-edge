// Minimal Tavily search client (server-only). https://docs.tavily.com
// Used by the Story Bank "Search the web" button. Plain fetch, no SDK.

import { TAVILY_API_KEY } from "./config.server";

export interface SearchHit {
  title: string;
  url: string;
  content: string;
}

export const tavilyConfigured = () => TAVILY_API_KEY.length > 0;

export async function tavilySearch(
  query: string,
  opts: { topic?: "general" | "news"; maxResults?: number } = {}
): Promise<SearchHit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TAVILY_API_KEY}` },
    body: JSON.stringify({
      query,
      topic: opts.topic ?? "general",
      search_depth: "basic", // 1 credit per search
      max_results: opts.maxResults ?? 5,
      include_answer: false,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Tavily ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { results?: SearchHit[] };
  return (data.results ?? []).map((r) => ({ title: r.title, url: r.url, content: r.content ?? "" }));
}
