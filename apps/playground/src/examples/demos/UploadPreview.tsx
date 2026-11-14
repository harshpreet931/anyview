import { useState } from 'react';
import { DocViewer, type DocumentModel, type ViewerError } from 'anyview';
import { sampleFile } from '../files';

type Status = { kind: 'empty' } | { kind: 'ready'; summary: string } | { kind: 'error'; message: string };

export function UploadPreview({ theme }: { theme: 'light' | 'dark' }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'empty' });

  const choose = (next: File | undefined) => {
    if (!next) return;
    setFile(next);
    setStatus({ kind: 'empty' });
  };

  const onLoad = (doc: DocumentModel) => {
    const pages = `${doc.pageCount} ${doc.pageCount === 1 ? 'page' : 'pages'}`;
    const size = `${(doc.meta.size / 1024).toFixed(1)} kB`;
    setStatus({ kind: 'ready', summary: `${doc.format.toUpperCase()} · ${pages} · ${size}` });
  };

  const onError = (error: ViewerError) => setStatus({ kind: 'error', message: error.message });

  return (
    <form className="ex-upload" onSubmit={(e) => e.preventDefault()}>
      <div className="ex-upload-fields">
        <label>
          Expense title
          <input defaultValue="Team offsite, March" />
        </label>
        <label className="ex-file">
          <input type="file" onChange={(e) => choose(e.target.files?.[0])} />
          <span>Choose a receipt or report</span>
        </label>
        <div className="ex-samples">
          or try
          <button type="button" onClick={() => choose(sampleFile('pdf-sample.pdf', 'receipt.pdf'))}>receipt.pdf</button>
          <button type="button" onClick={() => choose(sampleFile('csv-sample.csv', 'line-items.csv'))}>line-items.csv</button>
        </div>
        <p className="ex-status" data-kind={status.kind} aria-live="polite">
          {status.kind === 'ready' && status.summary}
          {status.kind === 'error' && status.message}
          {status.kind === 'empty' && (file ? 'Reading…' : 'Nothing attached yet')}
        </p>
        <button type="submit" className="ex-primary" disabled={status.kind !== 'ready'}>
          Submit expense
        </button>
      </div>

      <div className="ex-upload-preview">
        {file ? (
          <DocViewer
            source={{ kind: 'file', file }}
            theme={theme}
            showSidebar={false}
            onDocumentLoad={onLoad}
            onError={onError}
          />
        ) : (
          <div className="ex-placeholder">The preview shows up here, before anything is uploaded.</div>
        )}
      </div>
    </form>
  );
}
