import { useRef } from 'react';
import { CheckIcon, CopyIcon } from './icons';
import { useCopy } from './useCopy';

export function CopyCommand({ command }: { command: string }) {
  const { copied, copy } = useCopy(command);
  const codeRef = useRef<HTMLElement>(null);

  const onClick = async () => {
    if (await copy()) return;
    // Clipboard unavailable (insecure context, permissions): select the
    // command so a manual copy is one keystroke away.
    const code = codeRef.current;
    const sel = window.getSelection();
    if (code && sel) {
      const range = document.createRange();
      range.selectNodeContents(code);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  return (
    <button type="button" className="pg-npm" onClick={onClick} data-copied={copied} aria-label={`Copy "${command}"`}>
      <span className="pg-npm-prompt" aria-hidden="true">$</span>
      <code ref={codeRef}>{command}</code>
      <span className="pg-npm-icon" aria-hidden="true">
        <CopyIcon className="pg-npm-copy" width={15} height={15} />
        <CheckIcon className="pg-npm-check" width={15} height={15} />
      </span>
      <span className="pg-sr" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </button>
  );
}
