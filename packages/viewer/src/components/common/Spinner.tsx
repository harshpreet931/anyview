/* ============================================================
 * Spinner - loading spinner
 * ============================================================ */

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 24, className }: SpinnerProps) {
  return (
    <div
      className={`dv-spinner ${className ?? ''}`}
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
    />
  );
}
