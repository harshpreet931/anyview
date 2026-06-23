import { useState, useCallback, type ChangeEvent, type DragEvent } from 'react';
import { DocViewer, type FileSource, type DocumentModel, type ViewerError } from 'anyview';
import { SAMPLE_FILES, createSampleFileSource } from './samples';
import '../../../packages/viewer/src/styles/viewer.css';
import './playground.css';

export function App() {
  const [source, setSource] = useState<FileSource | undefined>(undefined);
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto' | 'sepia'>('auto');
  const [isDragging, setIsDragging] = useState(false);
  const [activeSample, setActiveSample] = useState<number | null>(null);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSource({ kind: 'file', file });
      setActiveSample(null);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSource({ kind: 'file', file });
      setActiveSample(null);
    }
  }, []);

  const loadSample = useCallback((index: number) => {
    const sample = SAMPLE_FILES[index];
    if (sample) {
      setSource(createSampleFileSource(sample));
      setActiveSample(index);
    }
  }, []);

  return (
    <div
      className="pg-root"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragging(false); }}
    >
      <header className="pg-header">
        <div className="pg-brand">
          <svg className="pg-logo" viewBox="0 0 32 32" aria-hidden="true">
            <rect className="pg-logo-stack" x="5" y="5" width="15" height="16.5" rx="3.5" />
            <rect className="pg-logo-card" x="9" y="8" width="17.5" height="18.5" rx="4.5" />
            <rect className="pg-logo-line" x="12.6" y="13.2" width="10.3" height="1.9" rx="0.95" />
            <rect className="pg-logo-line" x="12.6" y="16.9" width="10.3" height="1.9" rx="0.95" />
            <rect className="pg-logo-line" x="12.6" y="20.6" width="6.6" height="1.9" rx="0.95" />
          </svg>
          <div className="pg-brand-text">
            <h1>Anyview</h1>
            <p>Every format, one viewer.</p>
          </div>
        </div>

        <div className="pg-actions">
          <div className="pg-samples" role="group" aria-label="Sample documents">
            <span className="pg-eyebrow">Samples</span>
            {SAMPLE_FILES.map((sample, i) => (
              <button
                key={sample.fileName}
                className="pg-sample-chip"
                data-active={activeSample === i}
                onClick={() => loadSample(i)}
              >
                <span className="pg-chip-ext">{sample.fileName.split('.').pop()}</span>
                {sample.label}
              </button>
            ))}
          </div>

          <span className="pg-divider" aria-hidden="true" />

          <label className="pg-upload-btn">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.docx,.xlsx,.pptx,.csv,.tsv,.html,.htm,.md,.markdown,.txt,.log,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.avif,.ts,.tsx,.js,.jsx,.json,.yaml,.yml,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.css,.scss,.less,.vue,.svelte,.php,.sh,.bash,.zsh,.sql,.dockerfile"
            />
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13v6H5v-6H3v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6h-2zm-6-2.83V17h-2v-6.83L8.59 12 7.17 10.59 12 6l4.83 4.59L15.41 12 13 9.59z" /></svg>
            Open file
          </label>

          <select
            className="pg-theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as typeof theme)}
            aria-label="Viewer theme"
          >
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="sepia">Sepia</option>
          </select>
        </div>
      </header>

      <main className="pg-main">
        <div className="pg-canvas">
          <DocViewer
            {...(source ? { source } : {})}
            theme={theme}
            showToolbar
            showSidebar
            onDocumentLoad={(model: DocumentModel) => console.log('Loaded:', model.format, model.pageCount, 'pages')}
            onError={(err: ViewerError) => console.error('Error:', err)}
          />
        </div>
      </main>

      {isDragging && (
        <div className="pg-drop-overlay">
          <div className="pg-drop-overlay-inner">
            <svg viewBox="0 0 24 24"><path d="M19 13v6H5v-6H3v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6h-2zm-6-2.83V17h-2v-6.83L8.59 12 7.17 10.59 12 6l4.83 4.59L15.41 12 13 9.59z" /></svg>
            <span>Drop file to view</span>
          </div>
        </div>
      )}
    </div>
  );
}
