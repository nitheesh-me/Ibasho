/** Text normalisation and fuzzy matching for place search (case and diacritic insensitive). */

/** Lower case, diacritics stripped, punctuation to spaces, collapsed. */
export function normalise(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const tokens = (s: string): string[] => (normalise(s) ? normalise(s).split(' ') : []);

/** Damerau-Levenshtein (optimal string alignment) distance, capped: returns cap + 1 once above. */
export function editDistance(a: string, b: string, cap = 2): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const m = a.length;
  const n = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min((prev[j] as number) + 1, (cur[j - 1] as number) + 1, (prev[j - 1] as number) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, (prev2[j - 2] as number) + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > cap) return cap + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n] as number;
}

/** How well one query token matches one name token: 1 exact, 0.85 prefix, 0.6 fuzzy, else 0. */
export function tokenMatch(q: string, t: string): number {
  if (q === t) return 1;
  if (t.startsWith(q) && q.length >= 1) return q.length >= 2 || /\d/.test(q) ? 0.85 : 0.5;
  if (q.length >= 4) {
    const cap = q.length >= 7 ? 2 : 1;
    if (editDistance(q, t, cap) <= cap) return 0.6;
    if (t.length > q.length && editDistance(q, t.slice(0, q.length), cap) <= cap) return 0.5;
  }
  return 0;
}
