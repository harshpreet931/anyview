/* ============================================================
 * PasswordDialog - password prompt for encrypted documents
 * ============================================================ */

import { useState, useCallback, useRef } from 'react';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useStrings, formatString } from '../../i18n/I18nProvider';

interface PasswordDialogProps {
  fileName: string;
  /** True when a prior attempt was rejected - shows a "wrong password" hint. */
  incorrect?: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export function PasswordDialog({ fileName, incorrect, onSubmit, onCancel }: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const strings = useStrings();

  useFocusTrap(dialogRef, true, onCancel);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!password) {
        setError(true);
        return;
      }
      onSubmit(password);
    },
    [password, onSubmit],
  );

  return (
    <div className="dv-dialog-overlay" role="dialog" aria-modal="true" aria-label={strings.dialog.passwordTitle}>
      <div className="dv-dialog" ref={dialogRef} tabIndex={-1}>
        <div className="dv-dialog-header">
          <Icon name="lock" size={20} />
          <h2 className="dv-dialog-title">{strings.dialog.passwordTitle}</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="dv-dialog-description">
            {formatString(strings.dialog.passwordDescription, fileName)}
          </p>
          <input
            type="password"
            className="dv-search-input"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            aria-label={strings.dialog.passwordInput}
            style={{ width: '100%', marginTop: 'var(--dv-spacing-md)' }}
          />
          {(error || incorrect) && (
            <p className="dv-dialog-error" role="alert">
              {error ? strings.dialog.passwordEmpty : strings.dialog.passwordIncorrect}
            </p>
          )}
          <div className="dv-dialog-actions">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {strings.dialog.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {strings.dialog.passwordSubmit}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
