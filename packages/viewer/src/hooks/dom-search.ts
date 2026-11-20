import type { SearchQuery } from '../core/types';

const MAX_QUERY_LENGTH = 1000;
const MAX_MATCHES = 10_000;

export type Occurrence = [start: number, end: number];

export function findOccurrences(full: string, query: SearchQuery): Occurrence[] {
  if (!full || query.text.length > MAX_QUERY_LENGTH) return [];
  return query.regex ? regexOccurrences(full, query) : literalOccurrences(full, query);
}

function regexOccurrences(full: string, query: SearchQuery): Occurrence[] {
  let re: RegExp;
  try {
    re = new RegExp(query.text, query.caseSensitive ? 'g' : 'gi');
  } catch {
    return [];
  }
  const occurrences: Occurrence[] = [];
  for (let m = re.exec(full); m; m = re.exec(full)) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    occurrences.push([m.index, m.index + m[0].length]);
    if (occurrences.length >= MAX_MATCHES) break;
  }
  return occurrences;
}

function literalOccurrences(full: string, query: SearchQuery): Occurrence[] {
  const hay = query.caseSensitive ? full : full.toLowerCase();
  const needle = query.caseSensitive ? query.text : query.text.toLowerCase();
  const occurrences: Occurrence[] = [];
  if (!needle) return occurrences;
  let from = 0;
  for (let idx = hay.indexOf(needle, from); idx !== -1; idx = hay.indexOf(needle, from)) {
    const end = idx + needle.length;
    if (!query.wholeWord || isWholeWord(full, idx, end)) {
      occurrences.push([idx, end]);
      if (occurrences.length >= MAX_MATCHES) break;
    }
    from = end;
  }
  return occurrences;
}

function isWholeWord(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1]! : ' ';
  const after = end < text.length ? text[end]! : ' ';
  return !/\w/.test(before) && !/\w/.test(after);
}
