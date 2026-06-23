/* ============================================================
 * i18n Provider
 * Resolves a locale string to a ViewerStrings table and exposes
 * it (plus a {0}/{1} formatter) to components via context.
 * ============================================================ */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ViewerStrings } from './types';
import { en } from './en';

/**
 * Built-in locale registry. Consumers can add locales with
 * {@link registerStrings} before mounting the viewer.
 */
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

const I18nContext = createContext<ViewerStrings>(en);

export function I18nProvider({
  locale = 'en',
  strings,
  children,
}: {
  locale?: string;
  /** Explicit override; takes precedence over the locale lookup. */
  strings?: ViewerStrings;
  children: ReactNode;
}) {
  const value = useMemo(
    () => strings ?? resolveStrings(locale),
    [locale, strings],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the active string table. */
export function useStrings(): ViewerStrings {
  return useContext(I18nContext);
}

/** Replace `{0}`, `{1}`, … placeholders in a template string. */
export function formatString(
  template: string,
  ...args: Array<string | number>
): string {
  return template.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ''));
}
