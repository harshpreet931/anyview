import { useCallback, useEffect, useState } from 'react';

export type SiteTheme = 'light' | 'dark';

const KEY = 'anyview-site-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStored(): SiteTheme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): SiteTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Site (sky) theme. Follows the OS until the visitor picks one; the choice is
 * remembered per browser. A flip suppresses transitions for a frame so the
 * whole page snaps instead of smearing.
 */
export function useSiteTheme() {
  const [stored, setStored] = useState<SiteTheme | null>(readStored);
  const [system, setSystem] = useState<SiteTheme>(systemTheme);
  const theme = stored ?? system;

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const on = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const style = document.createElement('style');
    style.textContent = '*,*::before,*::after{transition:none !important}';
    document.head.appendChild(style);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    void root.offsetHeight;
    const id = requestAnimationFrame(() => style.remove());
    return () => {
      cancelAnimationFrame(id);
      style.remove();
    };
  }, [theme]);

  const toggle = useCallback(() => {
    const next: SiteTheme = theme === 'dark' ? 'light' : 'dark';
    setStored(next);
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  }, [theme]);

  return { theme, toggle };
}
