import type { PartialViewerStrings, ViewerStrings } from './types';
import { en } from './en';

const localeRegistry = new Map<string, ViewerStrings>([['en', en]]);

/** Overlays a possibly partial table on English, so a missing key never renders as undefined. */
export function withDefaults(strings: PartialViewerStrings): ViewerStrings {
  const out = { ...en } as Record<string, Record<string, string>>;
  for (const [section, values] of Object.entries(strings)) {
    if (values && section in en) out[section] = { ...out[section], ...values } as Record<string, string>;
  }
  return out as unknown as ViewerStrings;
}

/** Register (or override) the strings for a locale, e.g. `registerStrings('fr', fr)`. Missing keys fall back to English. */
export function registerStrings(locale: string, strings: PartialViewerStrings): void {
  localeRegistry.set(locale.toLowerCase(), withDefaults(strings));
}

/** Resolve a locale to its strings, falling back to the base language, then English. */
export function resolveStrings(locale: string): ViewerStrings {
  const key = locale.toLowerCase();
  return (
    localeRegistry.get(key) ??
    localeRegistry.get(key.split('-')[0]!) ??
    en
  );
}

/** Replace `{0}`, `{1}`, … placeholders in a template string. */
export function formatString(
  template: string,
  ...args: Array<string | number>
): string {
  return template.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''));
}
