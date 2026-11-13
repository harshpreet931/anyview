import { useStrings } from '../../i18n/I18nProvider';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 24, className }: SpinnerProps) {
  const strings = useStrings();
  return (
    <div
      className={`dv-spinner ${className ?? ''}`}
      role="status"
      aria-label={strings.viewer.loading}
      style={{ width: size, height: size }}
    />
  );
}
