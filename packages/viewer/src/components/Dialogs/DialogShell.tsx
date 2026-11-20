import { useRef, type ReactNode } from 'react';
import { Icon, type IconName } from '../common/Icon';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface DialogShellProps {
  title: string;
  onEscape: (() => void) | undefined;
  role?: 'dialog' | 'alertdialog';
  icon?: IconName;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function DialogShell({ title, onEscape, role = 'dialog', icon, headerAction, children }: DialogShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, onEscape);

  return (
    <div className="dv-dialog-overlay" role={role} aria-modal="true" aria-label={title}>
      <div className="dv-dialog" ref={dialogRef} tabIndex={-1}>
        <div className="dv-dialog-header">
          {icon && <Icon name={icon} size={20} />}
          <h2 className="dv-dialog-title">{title}</h2>
          {headerAction}
        </div>
        {children}
      </div>
    </div>
  );
}
