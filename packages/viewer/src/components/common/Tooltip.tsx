/* ============================================================
 * Tooltip - accessible tooltip wrapper
 * ============================================================ */

import { useId, type ReactNode } from 'react';

interface TooltipProps {
  label: string;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ label, children, placement = 'bottom' }: TooltipProps) {
  const id = useId();

  return (
    <span className="dv-tooltip-wrap" style={{ position: 'relative', display: 'inline-flex' }}>
      <span
        aria-describedby={id}
        onMouseEnter={(e) => {
          const tip = e.currentTarget.parentElement?.querySelector('.dv-tooltip');
          if (tip) (tip as HTMLElement).style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          const tip = e.currentTarget.parentElement?.querySelector('.dv-tooltip');
          if (tip) (tip as HTMLElement).style.opacity = '0';
        }}
      >
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className="dv-tooltip"
        data-placement={placement}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
          fontSize: 'var(--dv-font-size-sm)',
          background: 'var(--dv-overlay-color)',
          color: 'white',
          padding: '2px 8px',
          borderRadius: 'var(--dv-radius-sm)',
          zIndex: 1000,
        }}
      >
        {label}
      </span>
    </span>
  );
}
