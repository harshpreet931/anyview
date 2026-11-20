import type { SearchQuery } from './types';

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
