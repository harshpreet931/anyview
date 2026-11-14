import { useEffect, useRef, useState } from 'react';
import { DocViewer } from 'anyview';
import { sampleFile } from '../files';

const messages = [
  { from: 'Maya', text: 'Q3 numbers are in, take a look before standup.', file: sampleFile('pdf-sample.pdf', 'q3-report.pdf') },
  { from: 'Leo', text: 'Here is the signup export you asked for.', file: sampleFile('csv-sample.csv', 'signups.csv') },
  { from: 'Priya', text: 'Release notes draft, comments welcome.', file: sampleFile('markdown-sample.md', 'release-notes.md') },
];

export function ChatAttachments({ theme }: { theme: 'light' | 'dark' }) {
  const [open, setOpen] = useState<File | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <div className="ex-chat">
      {messages.map((m) => (
        <div key={m.file.name} className="ex-message">
          <span className="ex-avatar" aria-hidden="true">{m.from[0]}</span>
          <div>
            <strong>{m.from}</strong>
            <p>{m.text}</p>
            <button type="button" className="ex-attachment" onClick={() => setOpen(m.file)}>
              <span className="ex-attachment-ext">{m.file.name.split('.').pop()}</span>
              {m.file.name}
            </button>
          </div>
        </div>
      ))}

      <dialog ref={dialog} className="ex-modal" onClose={() => setOpen(null)} aria-label={open?.name}>
        <header>
          <span>{open?.name}</span>
          <button type="button" onClick={() => setOpen(null)} aria-label="Close preview">✕</button>
        </header>
        <div className="ex-modal-body">
          {open && <DocViewer source={{ kind: 'file', file: open }} theme={theme} showSidebar={false} />}
        </div>
      </dialog>
    </div>
  );
}
