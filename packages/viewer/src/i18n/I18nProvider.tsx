import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ViewerStrings } from './types';
import { en } from './en';
import { resolveStrings } from './strings';

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
