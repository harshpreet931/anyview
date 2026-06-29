/* ============================================================
 * State Components
 * Empty, Loading, Error, Unsupported states.
 * ============================================================ */

import { type ReactNode } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useFileInput } from '../../hooks/useFileInput';
import { useStrings, formatString } from '../../i18n/I18nProvider';

function StateContainer({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="dv-state-container" role="status">
      {icon && <div className="dv-state-icon">{icon}</div>}
      <div className="dv-state-title">{title}</div>
      {description && <div className="dv-state-description">{description}</div>}
      {children}
    </div>
  );
}

export function EmptyState({ description }: { description?: string }) {
  // The empty state is a real dropzone: click to browse or drop a file to open
  // it. It opens through the store, so it works whether or not the host passes
  // a `source` prop (when a source is given, this state isn't shown).
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
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="8" y="6" width="32" height="36" rx="2" />
            <path d="M16 18h16M16 26h16M16 34h10" />
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
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="24" cy="24" r="20" />
          <path d="M24 14v14M24 34v2" strokeLinecap="round" />
        </svg>
      }
      title={strings.states.error}
      {...(message ? { description: message } : {})}
    >
      {onRetry && (
        <button className="dv-button" onClick={onRetry} style={{ marginTop: 'var(--dv-spacing-lg)' }}>
          {strings.states.retry}
        </button>
      )}
    </StateContainer>
  );
}

export function UnsupportedState({ format }: { format?: string }) {
  const strings = useStrings();
  return (
    <StateContainer
      icon={
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 12l24 24M36 12L12 36" strokeLinecap="round" />
        </svg>
      }
      title={strings.states.unsupported}
      description={
        format
          ? formatString(strings.states.unsupportedFormat, format)
          : strings.states.unsupportedDescription
      }
    />
  );
}
