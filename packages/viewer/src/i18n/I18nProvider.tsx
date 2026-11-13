import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PartialViewerStrings, ViewerStrings } from './types';
import { en } from './en';
import { resolveStrings, withDefaults } from './strings';

const I18nContext = createContext<ViewerStrings>(en);
const LocaleContext = createContext('en');

export function I18nProvider({
  locale = 'en',
  strings,
  children,
}: {
  locale?: string;
  /** Explicit override; takes precedence over the locale lookup. */
  strings?: PartialViewerStrings;
  children: ReactNode;
}) {
  const value = useMemo(
    () => (strings ? withDefaults(strings) : resolveStrings(locale)),
    [locale, strings],
  );
  return (
    <LocaleContext.Provider value={locale}>
      <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    </LocaleContext.Provider>
  );
}

/** Access the active string table. */
export function useStrings(): ViewerStrings {
  return useContext(I18nContext);
}

/** The active BCP 47 locale, for dates and numbers. */
export function useLocale(): string {
  return useContext(LocaleContext);
}
