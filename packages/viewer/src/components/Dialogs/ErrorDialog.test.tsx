import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ViewerError } from '../../core/errors';
import { I18nProvider } from '../../i18n/I18nProvider';
import type { PartialViewerStrings } from '../../i18n/types';
import { ErrorDialog } from './ErrorDialog';

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function render(strings?: PartialViewerStrings) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const error = new ViewerError('PARSE_ERROR', 'Bad bytes', { retryable: true });
  act(() =>
    root!.render(
      <I18nProvider {...(strings ? { strings } : {})}>
        <ErrorDialog error={error} onRetry={() => {}} onDismiss={() => {}} />
      </I18nProvider>,
    ),
  );
  const dialog = host.querySelector('[role="alertdialog"]')!;
  return {
    label: dialog.getAttribute('aria-label'),
    title: dialog.querySelector('.dv-dialog-title')?.textContent,
    buttons: Array.from(dialog.querySelectorAll('button'), (b) => b.textContent),
  };
}

describe('ErrorDialog', () => {
  it('reads its title and buttons from the English strings', () => {
    expect(render()).toEqual({ label: 'Parse Error', title: 'Parse Error', buttons: ['Dismiss', 'Retry'] });
  });

  it('uses the active locale for its title and buttons', () => {
    const result = render({
      errors: { PARSE_ERROR: 'Erreur de lecture' },
      dialog: { dismiss: 'Fermer', retry: 'Réessayer' },
    });
    expect(result).toEqual({
      label: 'Erreur de lecture',
      title: 'Erreur de lecture',
      buttons: ['Fermer', 'Réessayer'],
    });
  });
});
