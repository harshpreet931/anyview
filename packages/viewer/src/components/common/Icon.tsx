import { type ReactNode, memo } from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

/* Line icons on a 24px grid, drawn with a round 1.75 stroke so they read
   light and even at 16-20px. Every name from the previous set is kept. */
const ICON_PATHS: Record<string, ReactNode> = {
  'chevron-left': <path d="M14.5 6l-6 6 6 6" />,
  'chevron-right': <path d="M9.5 6l6 6-6 6" />,
  'chevron-up': <path d="M6 14.5l6-6 6 6" />,
  'chevron-down': <path d="M6 9.5l6 6 6-6" />,
  'zoom-in': <path d="M12 5.5v13M5.5 12h13" />,
  'zoom-out': <path d="M5.5 12h13" />,
  'search': (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l4.5 4.5" />
    </>
  ),
  'download': <path d="M12 4v11m-5-4.5l5 5 5-5M5 20h14" />,
  'print': (
    <>
      <path d="M7 9V4.5h10V9" />
      <path d="M7 17H5.5A2.5 2.5 0 0 1 3 14.5v-3A2.5 2.5 0 0 1 5.5 9h13a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5H17" />
      <rect x="7" y="14" width="10" height="6" rx="1.25" />
    </>
  ),
  'rotate-cw': <path d="M20 12a8 8 0 1 1-2.34-5.66L20 8.5M20 4v4.5h-4.5" />,
  'rotate-ccw': <path d="M4 12a8 8 0 1 0 2.34-5.66L4 8.5M4 4v4.5h4.5" />,
  'sidebar': (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <path d="M9.5 4.5v15" />
    </>
  ),
  'more': (
    <>
      <circle cx="6" cy="12" r="1.1" fill="currentColor" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" />
      <circle cx="18" cy="12" r="1.1" fill="currentColor" />
    </>
  ),
  'close': <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  'folder': <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.6l2 2h7.4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  'file': (
    <>
      <path d="M7 3.5h6.5L19 9v10a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z" />
      <path d="M13.5 3.5V9H19" />
    </>
  ),
  'info': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  'warning': (
    <>
      <path d="M10.3 4.6L3.2 17a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  'error': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </>
  ),
  'lock': (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  'properties': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </>
  ),
  'fullscreen': (
    <path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3" />
  ),
  'marquee': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="3 2.6" />
      <path d="M12 9v6M9 12h6" />
    </>
  ),
  'highlight': (
    <>
      <path d="M14.5 4.5l5 5-7.5 7.5H7v-5z" />
      <path d="M4 20.5h16" />
    </>
  ),
  'ink': <path d="M3.5 16.5c2.5-5 4.5-5.5 5.5-2.5s3 3.5 5.5-1.5 4.5-5 6-2.5" />,
  'rectangle': <rect x="4" y="6" width="16" height="12" rx="2" />,
  'ellipse': <ellipse cx="12" cy="12" rx="8.5" ry="6" />,
  'line': <path d="M5 19L19 5" />,
  'arrow': <path d="M5 19L19 5M10 5h9v9" />,
  'text': <path d="M5.5 7V5h13v2M12 5v14M9 19h6" />,
  'free-text': <path d="M5.5 7V5h13v2M12 5v14M9 19h6" />,
  'sticky-note': (
    <>
      <path d="M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8l-6 6H7a2 2 0 0 1-2-2z" />
      <path d="M13 20v-4a2 2 0 0 1 2-2h4" />
    </>
  ),
};

export const Icon = memo(function Icon({ name, size = 16, className }: IconProps) {
  const path = ICON_PATHS[name];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
});
