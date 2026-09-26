import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getLLM, getWebSearchModel, llmLabel } from "@/lib/llm";
import { LANG_NAME } from "@/lib/i18n";
import { tavilyConfigured, tavilySearch, type SearchHit } from "@/lib/tavily";

export const runtime = "nodejs";
export const maxDuration = 90;

const SECTIONS = `Write plain text with these five short sections, each starting with its heading on its own line:
What they do
Where they are now (stage, scale, growth, recent news, current challenges)
Engineering and tech
Culture and values
What this means for the role (which responsibilities matter most right now, and why)`;

/**
 * "Search the web" on the Story Bank page.
 *   online (OpenRouter) → the LLM searches the web itself (OpenRouter web plugin)
 *   local  (Ollama)     → a few Tavily searches, then the local LLM summarises
 * Either way the learner gets an editable company profile plus its sources.
 */
export async function POST(req: NextRequest) {
  const { companyName, jobTitle, responsibilities, language } = await req.json();
  const name = String(companyName || "").trim();
  const langName = LANG_NAME[language] || "English";

  if (!name) {
    return NextResponse.json({ error: "No company", detail: "Type the company name first." }, { status: 400 });
  }

  const resp = Array.isArray(responsibilities) && responsibilities.length
    ? `The candidate is applying for ${jobTitle || "a role"} with these key responsibilities:\n${responsibilities.map((r: string) => `* ${r}`).join("\n")}\n`
    : jobTitle ? `The candidate is applying for ${jobTitle}.\n` : "";

  // ── Online: let the LLM search the web itself ──────────────────────────────
  let searchModel;
  try {
    searchModel = await getWebSearchModel();
  } catch (e) {
    return NextResponse.json({ error: "LLM not available", detail: String(e) }, { status: 500 });
  }
  if (searchModel) {
    try {
      const result = await generateText({
        model: searchModel,
        temperature: 0.2,
        prompt: `You are preparing a job candidate for interviews at ${name}.
Search the web for up-to-date information about ${name}: what they do, their current stage, scale and recent news (${new Date().getFullYear()}), their engineering and tech, and their culture and values. Then write a short company profile in ${langName}.

${resp}
${SECTIONS}

Rules: max 280 words in total. Use short sentences or dash lines. Only state facts you found; if something is unknown, say so briefly. If you find a different company with a similar name, ignore it. No markdown symbols like # or **. No citation markers or links in the text.`,
      });
      const text = result.text.replace(/\[\d+\]/g, "").trim();
      if (!text) throw new Error("empty");
      const seen = new Set<string>();
      const sources = result.sources
        .filter((s) => s.sourceType === "url")
        .map((s) => ({ title: (s as { title?: string }).title || (s as { url: string }).url, url: (s as { url: string }).url }))
        .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
        .slice(0, 8);
      return NextResponse.json({ text, sources, via: "llm" });
    } catch (e) {
      console.log(e);
      return NextResponse.json(
        {
          error: "Web search failed",
          detail: `${String(e)} — OpenRouter web search needs credits on your account, even with a free model.`,
          provider: await llmLabel().catch(() => "OpenRouter"),
        },
        { status: 502 }
      );
    }
  }

  // ── Local: Tavily search + local LLM summary ───────────────────────────────
  if (!tavilyConfigured()) {
    return NextResponse.json(
      { error: "Web search is not set up", detail: "In local mode web search uses Tavily: add TAVILY_API_KEY to .env.local (free key at tavily.com) and restart the dev server." },
      { status: 501 }
    );
  }

  const year = new Date().getFullYear();
  const queries: [string, "general" | "news"][] = [
    [`${name} company what they do products customers business model`, "general"],
    [`${name} engineering blog tech stack architecture`, "general"],
    [`${name} company values culture mission hiring`, "general"],
    [`${name} news ${year}`, "news"],
  ];

  let hits: SearchHit[] = [];
  try {
    const settled = await Promise.allSettled(queries.map(([q, topic]) => tavilySearch(q, { topic, maxResults: 4 })));
    const ok = settled.filter((r): r is PromiseFulfilledResult<SearchHit[]> => r.status === "fulfilled");
    if (!ok.length) throw (settled[0] as PromiseRejectedResult).reason;
    const seen = new Set<string>();
    hits = ok.flatMap((r) => r.value).filter((h) => (seen.has(h.url) ? false : (seen.add(h.url), true)));
  } catch (e) {
    return NextResponse.json({ error: "Web search failed", detail: String(e), provider: "Tavily" }, { status: 502 });
  }
  if (!hits.length) {
    return NextResponse.json({ error: "Nothing found", detail: `No web results for "${name}". Check the spelling, or write the profile yourself.` }, { status: 404 });
  }

  // Keep the prompt small: ~16 snippets, each trimmed.
  const snippets = hits
    .slice(0, 16)
    .map((h, i) => `[${i + 1}] ${h.title} (${h.url})\n${h.content.replace(/\s+/g, " ").slice(0, 700)}`)
    .join("\n\n");

  const prompt = `You are preparing a job candidate for interviews at ${name}.
Using ONLY the web search results below, write a short company profile in ${langName}.

${resp}
SEARCH RESULTS:
${snippets}

${SECTIONS}

Rules: max 280 words in total. Use short sentences or dash lines. Only state facts supported by the results; if something is unknown, say so briefly. If results are about a different company with a similar name, ignore them. No markdown symbols like # or **. No source numbers in the text.`;

  try {
    const { model } = await getLLM();
    const { text } = await generateText({ model, prompt, temperature: 0.2 });
    if (!text.trim()) throw new Error("empty");
    return NextResponse.json({
      text: text.trim(),
      sources: hits.slice(0, 8).map((h) => ({ title: h.title, url: h.url })),
      via: "tavily",
    });
  } catch (e) {
    console.log(e);
    return NextResponse.json(
      { error: "Summary failed", detail: String(e), provider: await llmLabel().catch(() => "the LLM") },
      { status: 500 }
    );
  }
}
