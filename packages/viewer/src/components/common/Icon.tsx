/* ============================================================
 * Icon — lightweight SVG icon component
 * ============================================================ */

import { type ReactNode, memo } from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

const ICON_PATHS: Record<string, ReactNode> = {
  'chevron-left': <path d="M10 4L6 8l4 4V4z" />,
  'chevron-right': <path d="M6 4l4 4-4 4V4z" />,
  'chevron-up': <path d="M4 10l4-4 4 4H4z" />,
  'chevron-down': <path d="M4 6l4 4 4-4H4z" />,
  'zoom-in': <path d="M7 4h2v3h3v2H9v3H7V9H4V7h3V4z" />,
  'zoom-out': <path d="M4 7h8v2H4V7z" />,
  'search': <path d="M11 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm-.7 4.3a6 6 0 1 0-.7.7l4 4 .7-.7-4-4z" />,
  'download': <path d="M8 1v8m0 0L4 5m4 4l4-4M2 13h12" />,
  'print': <path d="M4 4h8v4H4V4zm0 5h8v5H4V9zm2-4v2h4V5H6z" />,
  'rotate-cw': <path d="M8 3a5 5 0 1 0 5 5h2A7 7 0 1 1 8 1V0l4 2-4 2V3z" />,
  'rotate-ccw': <path d="M8 3a5 5 0 1 1-5 5H1a7 7 0 1 0 7-7V0L4 2l4 2V3z" />,
  'sidebar': <path d="M2 2h4v12H2V2zm5 0h7v12H7V2z" />,
  'close': <path d="M4 4l8 8M12 4l-8 8" />,
  'folder': <path d="M2 4h5l2 2h5v8H2V4z" />,
  'file': <path d="M4 2h6l4 4v8H4V2zm5 0v4h4" />,
  'info': <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 4v2m0 4v4" />,
  'warning': <path d="M8 1L1 14h14L8 1zm0 5v4m0 2v2" />,
  'error': <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 4v6m0 2v2" />,
  'lock': <path d="M4 7V5a4 4 0 1 1 8 0v2h1v7H3V7h1zm2 0h4V5a2 2 0 1 0-4 0v2z" />,
  'properties': <path d="M3 3h10v10H3V3zm2 2v2h6V5H5zm0 4v2h4V9H5z" />,
};

export const Icon = memo(function Icon({ name, size = 16, className }: IconProps) {
  const path = ICON_PATHS[name];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
});
