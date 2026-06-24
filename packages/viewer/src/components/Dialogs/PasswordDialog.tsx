/* ============================================================
 * PasswordDialog — password prompt for encrypted documents
 * ============================================================ */

import { useState, useCallback, useRef } from 'react';
import { Button } from '../common/Button';
import { Icon } from '../common/Icon';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface PasswordDialogProps {
  fileName: string;
  /** True when a prior attempt was rejected — shows a "wrong password" hint. */
  incorrect?: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export function PasswordDialog({ fileName, incorrect, onSubmit, onCancel }: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

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
    <div className="dv-dialog-overlay" role="dialog" aria-modal="true" aria-label="Password required">
      <div className="dv-dialog" ref={dialogRef} tabIndex={-1}>
        <div className="dv-dialog-header">
          <Icon name="lock" size={20} />
          <h2 className="dv-dialog-title">Password Required</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="dv-dialog-description">
            {`"${fileName}" is encrypted. Please enter the password to open it.`}
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
            aria-label="Password"
            style={{ width: '100%', marginTop: 'var(--dv-spacing-md)' }}
          />
          {(error || incorrect) && (
            <p className="dv-dialog-error" role="alert">
              {error ? 'Please enter a password.' : 'Incorrect password. Please try again.'}
            </p>
          )}
          <div className="dv-dialog-actions">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Unlock
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
