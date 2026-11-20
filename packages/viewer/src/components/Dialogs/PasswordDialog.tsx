import { useState } from 'react';
import { Button } from '../common/Button';
import { useStrings } from '../../i18n/I18nProvider';
import { formatString } from '../../i18n/strings';
import { DialogShell } from './DialogShell';

interface PasswordDialogProps {
  fileName: string;
  incorrect?: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export function PasswordDialog({ fileName, incorrect, onSubmit, onCancel }: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [showEmptyError, setShowEmptyError] = useState(false);
  const strings = useStrings();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setShowEmptyError(true);
      return;
    }
    onSubmit(password);
  };

  return (
    <DialogShell title={strings.dialog.passwordTitle} icon="lock" onEscape={onCancel}>
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
            setShowEmptyError(false);
          }}
          aria-label={strings.dialog.passwordInput}
          style={{ width: '100%', marginTop: 'var(--dv-spacing-md)' }}
        />
        {(showEmptyError || incorrect) && (
          <p className="dv-dialog-error" role="alert">
            {showEmptyError ? strings.dialog.passwordEmpty : strings.dialog.passwordIncorrect}
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
    </DialogShell>
  );
}
