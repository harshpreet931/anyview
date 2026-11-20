import type { SearchQuery } from './types';

const MAX_QUERY_LENGTH = 1000;
export const MAX_MATCHES = 10_000;

export type Occurrence = [start: number, end: number];

/** Finds up to `limit` non-overlapping occurrences of a compiled query in `text`. */
export type OccurrenceFinder = (text: string, limit: number) => Occurrence[];

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `null` for an empty query or a regex the user typed that does not compile. */
export function searchPattern(query: SearchQuery): RegExp | null {
  if (!query.text) return null;
  const flags = query.caseSensitive ? 'g' : 'gi';
  const pattern = query.regex ? query.text : escapeRegex(query.text);
  try {
    return new RegExp(query.wholeWord && !query.regex ? `\\b${pattern}\\b` : pattern, flags);
  } catch {
    return null;
  }
}

/** Compiles the query once, to run over many texts. `null` when it can match nothing. */
export function occurrenceFinder(query: SearchQuery): OccurrenceFinder | null {
  if (!query.text || query.text.length > MAX_QUERY_LENGTH) return null;
  return query.regex ? regexFinder(query) : literalFinder(query);
}

export function findOccurrences(full: string, query: SearchQuery): Occurrence[] {
  return occurrenceFinder(query)?.(full, MAX_MATCHES) ?? [];
}

function regexFinder(query: SearchQuery): OccurrenceFinder | null {
  let re: RegExp;
  try {
    re = new RegExp(query.text, query.caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
  return (text, limit) => {
    const occurrences: Occurrence[] = [];
    re.lastIndex = 0;
    for (let m = re.exec(text); m && occurrences.length < limit; m = re.exec(text)) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      occurrences.push([m.index, m.index + m[0].length]);
    }
    return occurrences;
  };
}

function literalFinder(query: SearchQuery): OccurrenceFinder {
  const needle = query.caseSensitive ? query.text : query.text.toLowerCase();
  return (text, limit) => {
    const occurrences: Occurrence[] = [];
    if (!text || limit <= 0) return occurrences;
    const hay = query.caseSensitive ? text : text.toLowerCase();
    let from = 0;
    for (let idx = hay.indexOf(needle, from); idx !== -1; idx = hay.indexOf(needle, from)) {
      const end = idx + needle.length;
      if (!query.wholeWord || isWholeWord(text, idx, end)) {
        occurrences.push([idx, end]);
        if (occurrences.length >= limit) break;
      }
      from = end;
    }
    return occurrences;
  };
}

function isWholeWord(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1]! : ' ';
  const after = end < text.length ? text[end]! : ' ';
  return !/\w/.test(before) && !/\w/.test(after);
}
