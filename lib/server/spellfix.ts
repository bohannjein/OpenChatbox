/**
 * Fuzzy correction of company/person proper nouns in a search query.
 *
 * Ordinary spellcheckers don't know instance-specific names ("ispa hub"), so a
 * mistyped proper noun ("ipsa hab") makes the whole search miss. This module
 * corrects such tokens against an admin-configured dictionary BEFORE the query
 * hits the search backend.
 *
 * Distance metric is Damerau-Levenshtein (optimal string alignment): unlike
 * plain Levenshtein it counts an adjacent transposition ("ipsa"→"ispa") as a
 * single edit, which is exactly the dominant typo class for proper nouns.
 */

/**
 * Damerau-Levenshtein distance (OSA variant) between two strings — number of
 * insertions, deletions, substitutions and adjacent transpositions to turn `a`
 * into `b`.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const d: number[][] = Array.from({ length: al + 1 }, () =>
    new Array<number>(bl + 1).fill(0)
  );
  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      // adjacent transposition (…ab… ↔ …ba…)
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[al][bl];
}

/**
 * Is `candidate` close enough to the canonical proper noun `canonical` to be
 * treated as a typo of it? Length-aware: allows ~1 edit per 3 characters, and
 * rejects pairs whose lengths differ too much to plausibly be the same word.
 * Strings under 4 chars must match exactly (too little signal to fuzz safely).
 */
export function isProperNounMatch(candidate: string, canonical: string): boolean {
  const x = candidate.toLowerCase();
  const y = canonical.toLowerCase();
  if (x === y) return false; // already correct — nothing to fix
  const maxLen = Math.max(x.length, y.length);
  if (maxLen < 4) return false;
  const maxDist = Math.max(1, Math.floor(y.length / 3));
  if (Math.abs(x.length - y.length) > maxDist + 1) return false;
  return damerauLevenshtein(x, y) <= maxDist;
}

export interface ProperNounCorrection {
  /** the query after replacing near-miss tokens with their canonical form */
  corrected: string;
  /** every replacement that was applied (empty if nothing matched) */
  replacements: { from: string; to: string }[];
}

/**
 * Correct proper nouns in `query` against `dictionary` (admin-configured
 * canonical names, single- or multi-word). Slides a word-window the width of
 * each dictionary entry over the query and replaces a fuzzy-matching window with
 * the canonical name. Longer (multi-word) names are matched first so they win
 * over their individual words; each query word is consumed at most once.
 */
export function correctProperNouns(
  query: string,
  dictionary: string[]
): ProperNounCorrection {
  const words = query.trim().split(/\s+/).filter(Boolean);
  const nouns = dictionary.map((n) => n.trim()).filter(Boolean);
  if (!words.length || !nouns.length) {
    return { corrected: query, replacements: [] };
  }

  const replacements: { from: string; to: string }[] = [];
  const locked = new Array<boolean>(words.length).fill(false);

  // Multi-word names first: "ispa hub" should win over a lone "hub".
  const ordered = [...nouns].sort(
    (a, b) => b.split(/\s+/).length - a.split(/\s+/).length
  );

  for (const noun of ordered) {
    const width = noun.split(/\s+/).length;
    for (let i = 0; i + width <= words.length; i++) {
      let overlaps = false;
      for (let k = i; k < i + width; k++) if (locked[k]) overlaps = true;
      if (overlaps) continue;

      const windowStr = words.slice(i, i + width).join(" ");
      if (windowStr.toLowerCase() === noun.toLowerCase()) {
        // Already spelled correctly — lock it so nothing else touches it.
        for (let k = i; k < i + width; k++) locked[k] = true;
        continue;
      }
      if (isProperNounMatch(windowStr, noun)) {
        replacements.push({ from: windowStr, to: noun });
        words[i] = noun; // canonical form (may itself contain spaces)
        for (let k = i + 1; k < i + width; k++) words[k] = "";
        for (let k = i; k < i + width; k++) locked[k] = true;
      }
    }
  }

  const corrected = words.filter(Boolean).join(" ");
  return { corrected, replacements };
}
