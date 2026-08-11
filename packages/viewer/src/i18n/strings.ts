import type { ViewerStrings } from './types';
import { en } from './en';

const localeRegistry = new Map<string, ViewerStrings>([['en', en]]);

/** Register (or override) the strings for a locale, e.g. `registerStrings('fr', fr)`. */
export function registerStrings(locale: string, strings: ViewerStrings): void {
  localeRegistry.set(locale.toLowerCase(), strings);
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
