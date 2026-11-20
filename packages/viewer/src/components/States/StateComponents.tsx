import { type ReactNode } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useFileInput } from '../../hooks/useFileInput';
import { useStrings } from '../../i18n/I18nProvider';
import { Button } from '../common/Button';

function StateContainer({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="dv-state-container" role="status">
      <div className="dv-state-icon">{icon}</div>
      <div className="dv-state-title">{title}</div>
      {description && <div className="dv-state-description">{description}</div>}
      {children}
    </div>
  );
}

export function EmptyState({ description }: { description?: string }) {
  const openDocument = useViewerStore((s) => s.openDocument);
  const strings = useStrings();
  const { inputRef, isDragging, openPicker, handleInputChange, dragProps } =
    useFileInput({ onFile: openDocument });

  return (
    <div
      className="dv-empty-dropzone"
      data-dragging={isDragging || undefined}
      role="button"
      tabIndex={0}
      aria-label={strings.states.openPrompt}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
      {...dragProps}
    >
      <input
        ref={inputRef}
        type="file"
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      <StateContainer
        icon={
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M14 5h14l11 11v25a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" />
            <path d="M28 5v8a3 3 0 0 0 3 3h8" />
            <path d="M18 26h12M18 33h8" />
          </svg>
        }
        title={strings.states.empty}
        description={description || strings.states.emptyDescription}
      />
    </div>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const strings = useStrings();
  return (
    <StateContainer
      icon={<div className="dv-spinner" />}
      title={label || strings.states.loading}
    />
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const strings = useStrings();
  return (
    <StateContainer
      icon={
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="24" cy="24" r="18" />
          <path d="M24 14v14M24 34v2" strokeLinecap="round" />
        </svg>
      }
      title={strings.states.error}
      description={message}
    >
      {onRetry && (
        <Button variant="primary" className="dv-state-action" onClick={onRetry}>
          {strings.states.retry}
        </Button>
      )}
    </StateContainer>
  );
}
