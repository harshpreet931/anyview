import type { ViewerError } from '../../core/errors';
import { Button } from '../common/Button';
import { useStrings } from '../../i18n/I18nProvider';
import { DialogShell } from './DialogShell';

interface ErrorDialogProps {
  error: ViewerError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDialog({ error, onRetry, onDismiss }: ErrorDialogProps) {
  const strings = useStrings();

  return (
    <DialogShell role="alertdialog" title={strings.errors?.[error.code] ?? error.code} icon="error" onEscape={onDismiss}>
      <div className="dv-dialog-body">
        <p className="dv-dialog-description">{error.message}</p>
        {error.cause instanceof Error && <p className="dv-dialog-detail">{error.cause.message}</p>}
      </div>
      <div className="dv-dialog-actions">
        {onDismiss && (
          <Button variant="ghost" onClick={onDismiss}>
            {strings.dialog.dismiss}
          </Button>
        )}
        {error.retryable && onRetry && (
          <Button variant="primary" onClick={onRetry}>
            {strings.dialog.retry}
          </Button>
        )}
      </div>
    </DialogShell>
  );
}
