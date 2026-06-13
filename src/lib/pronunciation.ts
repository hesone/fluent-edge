// Normalize a word: lowercase, strip punctuation
export const normalizeWord = (w: string) =>
  w.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}']/gu, "");

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

// returns true if spoken word matches expected within tolerance
export function wordMatches(spoken: string, expected: string): boolean {
  const s = normalizeWord(spoken), e = normalizeWord(expected);
  if (!s || !e) return false;
  if (s === e) return true;
  const dist = levenshtein(s, e);
  const tol = e.length <= 4 ? 1 : e.length <= 7 ? 2 : 3;
  return dist <= tol;
}

export type WordState = "pending" | "correct" | "wrong";

// Sequentially match transcript words against expected words (karaoke).
// Returns per-expected-word state and the highest matched index.
export function matchTranscript(transcript: string, expected: string[]): {
  states: WordState[];
  matchedCount: number;
} {
  const spoken = transcript.split(/\s+/).filter(Boolean).map(normalizeWord).filter(Boolean);
  const states: WordState[] = expected.map(() => "pending");
  let ei = 0; // expected pointer
  let si = 0; // spoken pointer

  while (ei < expected.length && si < spoken.length) {
    if (wordMatches(spoken[si], expected[ei])) {
      states[ei] = "correct";
      ei++; si++;
    } else {
      // lookahead: maybe user skipped or mispronounced — try matching next expected
      const nextMatch =
        ei + 1 < expected.length && wordMatches(spoken[si], expected[ei + 1]);
      if (nextMatch) {
        states[ei] = "wrong";
        ei++; // skip, handle this spoken on next loop
      } else {
        si++; // ignore stray spoken word
      }
    }
  }
  const matchedCount = states.filter((s) => s === "correct").length;
  return { states, matchedCount };
}

export function pronunciationScore(states: WordState[]): number {
  if (!states.length) return 0;
  const correct = states.filter((s) => s === "correct").length;
  return Math.round((correct / states.length) * 100);
}