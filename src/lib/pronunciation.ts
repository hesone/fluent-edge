// ─────────────────────────────────────────────────────────────────────────────
// Pronunciation matching with a normalization layer.
//
// Both the script (expected words) and the STT transcript pass through the
// SAME expansion pipeline, so any deterministic rewrite can only improve
// matching — identical inputs always stay identical. The pipeline turns each
// whitespace-delimited token into 0+ normalized "sub-tokens":
//
//   "real-time"  → ["real", "time"]      (hyphen split)
//   "don't"      → ["do", "not"]         (contraction expansion)
//   "25"         → ["twenty", "five"]    (number → words)
//   "100%"       → ["one", "hundred", "percent"]
//   "$40"        → ["forty", "dollars"]
//   "Dr."        → ["doctor"]            (abbreviation)
//   "&"          → ["and"]
//
// Matching runs on the sub-token streams; each expected sub-token remembers
// which display word it came from, and a display word is "correct" only when
// all of its sub-tokens matched. This fixes the whole class of
// one-word-vs-two-words mismatches without touching the display layer.
//
// Note: the expansion maps are English-centric. That's safe for other
// languages because both sides share the pipeline — a rewrite that doesn't
// apply simply leaves tokens unchanged on both sides.
// ─────────────────────────────────────────────────────────────────────────────

// Normalize a word: lowercase, strip diacritics + punctuation.
// (Still used by WordSpans for mask length.)
export const normalizeWord = (w: string) =>
  w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}']/gu, "");

// ─── Number → words ──────────────────────────────────────────────────────────

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function numberToWords(n: number): string[] {
  if (n < 20) return [ONES[n]];
  if (n < 100) {
    const rest = n % 10;
    return rest ? [TENS[Math.floor(n / 10)], ONES[rest]] : [TENS[Math.floor(n / 10)]];
  }
  if (n < 1000) {
    const head = [ONES[Math.floor(n / 100)], "hundred"];
    const rest = n % 100;
    return rest ? [...head, ...numberToWords(rest)] : head;
  }
  if (n < 1_000_000) {
    const head = [...numberToWords(Math.floor(n / 1000)), "thousand"];
    const rest = n % 1000;
    return rest ? [...head, ...numberToWords(rest)] : head;
  }
  if (n < 1_000_000_000) {
    const head = [...numberToWords(Math.floor(n / 1_000_000)), "million"];
    const rest = n % 1_000_000;
    return rest ? [...head, ...numberToWords(rest)] : head;
  }
  // huge numbers: digit by digit
  return String(n).split("").map((d) => ONES[+d]);
}

const ORDINAL_IRREGULAR: Record<string, string> = {
  one: "first", two: "second", three: "third", five: "fifth",
  eight: "eighth", nine: "ninth", twelve: "twelfth",
};

function toOrdinalWord(w: string): string {
  if (ORDINAL_IRREGULAR[w]) return ORDINAL_IRREGULAR[w];
  if (w.endsWith("y")) return w.slice(0, -1) + "ieth";
  return w + "th";
}

// ─── Token expansion ─────────────────────────────────────────────────────────

// Exact-token rewrites (checked before generic contraction rules).
const TOKEN_MAP: Record<string, string[]> = {
  // irregular contractions the generic n't rule would mangle
  "won't": ["will", "not"],
  "can't": ["can", "not"],
  "shan't": ["shall", "not"],
  cannot: ["can", "not"],
  "i'm": ["i", "am"],
  "let's": ["let", "us"],
  // colloquial
  gonna: ["going", "to"],
  wanna: ["want", "to"],
  gotta: ["got", "to"],
  kinda: ["kind", "of"],
  sorta: ["sort", "of"],
  // abbreviations / variants
  okay: ["ok"],
  etc: ["et", "cetera"],
  mr: ["mister"],
  mrs: ["missus"],
  dr: ["doctor"],
  vs: ["versus"],
  // symbols
  "&": ["and"],
  "+": ["plus"],
  "@": ["at"],
  "%": ["percent"],
};

const APOSTROPHE_SUFFIX: Record<string, string> = {
  re: "are", ll: "will", ve: "have", d: "would", m: "am",
};

// Expand one part (no hyphens/slashes left) into normalized sub-tokens.
function expandPart(part: string): string[] {
  let p = part;
  if (!p) return [];
  if (TOKEN_MAP[p]) return TOKEN_MAP[p];

  // currency prefix / percent suffix become trailing words
  const tail: string[] = [];
  const cur = p.match(/^([$€£])(.*)$/);
  if (cur) {
    tail.push(cur[1] === "$" ? "dollars" : cur[1] === "€" ? "euros" : "pounds");
    p = cur[2];
  }
  if (p.endsWith("%")) {
    tail.unshift("percent");
    p = p.slice(0, -1);
  }

  // strip punctuation, keeping letters, digits, apostrophes, and dots/commas
  // inside numbers ("1,000" → "1000"; "3.5" stays)
  p = p.replace(/,(?=\d)/g, "");
  p = p.replace(/[^\p{L}\p{N}'.]/gu, "");
  p = p.replace(/(?<!\d)\.|\.(?!\d)/g, ""); // drop dots not between digits
  p = p.replace(/^'+|'+$/g, "");            // surrounding quote-apostrophes
  if (!p) return tail;

  // numbers
  let m = p.match(/^(\d+)(st|nd|rd|th)$/);
  if (m) {
    const ws = numberToWords(+m[1]);
    ws[ws.length - 1] = toOrdinalWord(ws[ws.length - 1]);
    return [...ws, ...tail];
  }
  m = p.match(/^(\d+)\.(\d+)$/);
  if (m) return [...numberToWords(+m[1]), "point", ...m[2].split("").map((d) => ONES[+d]), ...tail];
  if (/^\d+$/.test(p)) return [...numberToWords(+p), ...tail];

  // contractions
  if (TOKEN_MAP[p]) return [...TOKEN_MAP[p], ...tail];
  m = p.match(/^(\p{L}+)n't$/u);
  if (m) return [m[1], "not", ...tail];
  m = p.match(/^(\p{L}+)'(re|ll|ve|d|m)$/u);
  if (m) return [m[1], APOSTROPHE_SUFFIX[m[2]], ...tail];

  return [p, ...tail];
}

// Expand one whitespace-delimited token into 0+ normalized sub-tokens.
export function expandToken(raw: string): string[] {
  const w = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'");
  // split compounds: hyphens (all variants), slashes, underscores
  return w.split(/[-‐‑–—/_]+/).flatMap(expandPart);
}

// ─── Fuzzy sub-token matching ────────────────────────────────────────────────

// Levenshtein distance for fuzzy matching of spoken vs expected
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[m][n];
}

// true if an already-normalized spoken sub-token matches an expected one
function subTokenMatches(spoken: string, expected: string): boolean {
  if (!spoken || !expected) return false;
  if (spoken === expected) return true;
  const dist = levenshtein(spoken, expected);
  const tol = expected.length <= 4 ? 1 : expected.length <= 7 ? 2 : 3;
  return dist <= tol;
}

// returns true if a raw spoken word matches a raw expected word within tolerance
export function wordMatches(spoken: string, expected: string): boolean {
  const s = expandToken(spoken), e = expandToken(expected);
  if (!s.length || s.length !== e.length) return false;
  return s.every((tok, i) => subTokenMatches(tok, e[i]));
}

// ─── Transcript → display-word states ────────────────────────────────────────

export type WordState = "pending" | "correct" | "wrong";

// how many expected sub-tokens ahead to search when the current one mismatches
const LOOKAHEAD = 2;

// Sequentially match transcript sub-tokens against expected sub-tokens
// (karaoke), then reduce back to per-display-word states.
export function matchTranscript(transcript: string, expected: string[]): {
  states: WordState[];
  matchedCount: number;
} {
  // expand expected words, remembering which display word each sub-token
  // belongs to
  const expSubs: { text: string; wordIndex: number }[] = [];
  expected.forEach((w, i) => {
    for (const t of expandToken(w)) expSubs.push({ text: t, wordIndex: i });
  });
  const spoken = transcript.split(/\s+/).filter(Boolean).flatMap(expandToken);

  const subStates: WordState[] = expSubs.map(() => "pending");
  let ei = 0; // expected sub-token pointer
  let si = 0; // spoken sub-token pointer

  while (ei < expSubs.length && si < spoken.length) {
    if (subTokenMatches(spoken[si], expSubs[ei].text)) {
      subStates[ei] = "correct";
      ei++; si++;
    } else {
      // lookahead: user may have skipped or mispronounced expected sub-tokens
      let skip = 0;
      for (let k = 1; k <= LOOKAHEAD && ei + k < expSubs.length; k++) {
        if (subTokenMatches(spoken[si], expSubs[ei + k].text)) { skip = k; break; }
      }
      if (skip > 0) {
        for (let k = 0; k < skip; k++) subStates[ei + k] = "wrong";
        ei += skip; // matched sub handled on next loop
      } else {
        si++; // ignore stray spoken sub-token
      }
    }
  }

  // reduce sub-token states to display-word states: correct only when ALL
  // sub-tokens matched; wrong as soon as any sub-token is wrong
  const groups: WordState[][] = expected.map(() => []);
  expSubs.forEach((s, idx) => groups[s.wordIndex].push(subStates[idx]));
  const states: WordState[] = groups.map((g) =>
    g.length === 0
      ? "correct" // pure punctuation token — nothing to speak
      : g.includes("wrong") ? "wrong"
      : g.every((st) => st === "correct") ? "correct"
      : "pending"
  );

  const matchedCount = states.filter((s) => s === "correct").length;
  return { states, matchedCount };
}

export function pronunciationScore(states: WordState[]): number {
  if (!states.length) return 0;
  const correct = states.filter((s) => s === "correct").length;
  return Math.round((correct / states.length) * 100);
}
