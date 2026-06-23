/* ============================================================
 * State Components
 * Empty, Loading, Error, Unsupported states.
 * ============================================================ */

import { type ReactNode } from 'react';

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
  return (
    <StateContainer
      icon={
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="8" y="6" width="32" height="36" rx="2" />
          <path d="M16 18h16M16 26h16M16 34h10" />
        </svg>
      }
      title="No document open"
      description={description || 'Drag and drop a file here, or click to browse'}
    />
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <StateContainer
      icon={<div className="dv-spinner" />}
      title={label || 'Loading document...'}
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
  return (
    <StateContainer
      icon={
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="24" cy="24" r="20" />
          <path d="M24 14v14M24 34v2" strokeLinecap="round" />
        </svg>
      }
      title="Failed to load document"
      {...(message ? { description: message } : {})}
    >
      {onRetry && (
        <button className="dv-button" onClick={onRetry} style={{ marginTop: 'var(--dv-spacing-lg)' }}>
          Retry
        </button>
      )}
    </StateContainer>
  );
}

export function UnsupportedState({ format }: { format?: string }) {
  return (
    <StateContainer
      icon={
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 12l24 24M36 12L12 36" strokeLinecap="round" />
        </svg>
      }
      title="Unsupported format"
      description={format ? `Format "${format}" is not supported` : 'This file format is not supported'}
    />
  );
}
