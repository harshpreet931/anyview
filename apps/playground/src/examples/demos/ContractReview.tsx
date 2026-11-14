import { useRef, useState } from 'react';
import { DocViewer, type Annotation, type AnnotationTool, type DocViewerRef } from 'anyview';
import { sampleFile } from '../files';

const contract = { kind: 'file' as const, file: sampleFile('pdf-sample.pdf', 'vendor-agreement.pdf') };

const LABELS: Record<Annotation['type'], string> = {
  highlight: 'Highlight',
  ink: 'Drawing',
  'sticky-note': 'Note',
  shape: 'Shape',
  'free-text': 'Text',
};

function describe(a: Annotation): string {
  if (a.type === 'sticky-note') return a.data.comment;
  if (a.type === 'free-text') return a.data.text;
  return LABELS[a.type];
}

export function ContractReview({ theme }: { theme: 'light' | 'dark' }) {
  const viewer = useRef<DocViewerRef>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [exported, setExported] = useState<string | null>(null);
  const [tool, setTool] = useState<AnnotationTool | null>(null);

  const pick = (next: AnnotationTool) => {
    const value = tool === next ? null : next;
    viewer.current?.setActiveTool(value);
    setTool(value);
  };

  const exportJson = () => {
    const sidecar = viewer.current?.exportAnnotations();
    if (sidecar) setExported(JSON.stringify(sidecar, null, 2));
  };

  return (
    <div className="ex-review">
      <div className="ex-review-viewer">
        <DocViewer
          ref={viewer}
          source={contract}
          theme={theme}
          showSidebar={false}
          onAnnotationChange={setAnnotations}
        />
      </div>
      <aside className="ex-review-panel">
        <h4>Review comments</h4>
        <div className="ex-tools" role="group" aria-label="Markup tools">
          <button type="button" aria-pressed={tool === 'highlight'} onClick={() => pick('highlight')}>
            Highlight
          </button>
          <button type="button" aria-pressed={tool === 'sticky-note'} onClick={() => pick('sticky-note')}>
            Note
          </button>
        </div>
        {annotations.length === 0 ? (
          <p className="ex-hint">Pick a tool, then drag across a line or click to leave a note.</p>
        ) : (
          <ol>
            {annotations.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => viewer.current?.goToPage(a.pageIndex)}>
                  <span>p.{a.pageIndex + 1}</span>
                  {describe(a)}
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="ex-review-actions">
          <button type="button" onClick={exportJson} disabled={annotations.length === 0}>
            Export JSON
          </button>
          <button type="button" onClick={() => viewer.current?.clearAnnotations()} disabled={annotations.length === 0}>
            Clear
          </button>
        </div>
        {exported && <pre className="ex-json">{exported}</pre>}
      </aside>
    </div>
  );
}
