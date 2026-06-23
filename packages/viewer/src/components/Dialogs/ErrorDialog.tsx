/* ============================================================
 * ErrorDialog — error display with retry
 * ============================================================ */

import { useRef } from 'react';
import type { ViewerError } from '../../core/errors';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ErrorDialogProps {
  error: ViewerError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDialog({ error, onRetry, onDismiss }: ErrorDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, onDismiss);
  const title = error.code
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');

  return (
    <div className="dv-dialog-overlay" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="dv-dialog" ref={dialogRef} tabIndex={-1}>
        <div className="dv-dialog-header">
          <Icon name="error" size={20} />
          <h2 className="dv-dialog-title">{title}</h2>
        </div>
        <div className="dv-dialog-body">
          <p className="dv-dialog-description">{error.message}</p>
          {error.cause instanceof Error && (
            <p className="dv-dialog-detail" style={{ fontSize: 'var(--dv-font-size-sm)', opacity: 0.7 }}>
              {error.cause.message}
            </p>
          )}
        </div>
        <div className="dv-dialog-actions">
          {onDismiss && (
            <Button variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
          {error.retryable && onRetry && (
            <Button variant="primary" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
