import { LogoMark } from './Mascot';
import { GitHubIcon, MoonIcon, SunIcon } from './icons';
import type { SiteTheme } from './useSiteTheme';

export const REPO = 'https://github.com/harshpreet931/anyview';

export function Sky({ clouds }: { clouds: number }) {
  return (
    <div className="pg-sky" aria-hidden="true">
      {Array.from({ length: clouds }, (_, i) => (
        <span key={i} className={`pg-cloud pg-cloud-${i + 1}`} />
      ))}
      <span className="pg-stars" />
      <span className="pg-grain" />
    </div>
  );
}

export function HomeLink() {
  return (
    <a className="pg-round pg-home" href={import.meta.env.BASE_URL} aria-label="anyview home">
      <LogoMark />
    </a>
  );
}

export function GitHubLink() {
  return (
    <a className="pg-round pg-hide-sm" href={REPO} aria-label="anyview on GitHub">
      <GitHubIcon />
    </a>
  );
}

export function ThemeToggle({ theme, onToggle }: { theme: SiteTheme; onToggle: () => void }) {
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      className="pg-round pg-theme-toggle"
      onClick={onToggle}
      aria-label={label}
      title={label}
      data-theme-icon={theme}
    >
      <SunIcon className="pg-icon-sun" />
      <MoonIcon className="pg-icon-moon" />
    </button>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      any<em>view</em>
    </span>
  );
}
