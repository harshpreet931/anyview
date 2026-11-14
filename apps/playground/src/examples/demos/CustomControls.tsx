import { DocViewer, useNavigation, useZoom } from 'anyview';
import { sampleFile } from '../files';

const deck = { kind: 'file' as const, file: sampleFile('pdf-sample.pdf', 'pitch-deck.pdf') };

function Controls() {
  const { currentPage, totalPages, prevPage, nextPage } = useNavigation();
  const { zoom, zoomIn, zoomOut } = useZoom();

  return (
    <div className="ex-controls" role="toolbar" aria-label="Deck controls">
      <button type="button" onClick={prevPage} disabled={currentPage === 0} aria-label="Previous slide">‹</button>
      <span>{currentPage + 1} / {totalPages}</span>
      <button type="button" onClick={nextPage} disabled={currentPage >= totalPages - 1} aria-label="Next slide">›</button>
      <span className="ex-controls-sep" aria-hidden="true" />
      <button type="button" onClick={zoomOut} aria-label="Zoom out">−</button>
      <span>{Math.round(zoom * 100)}%</span>
      <button type="button" onClick={zoomIn} aria-label="Zoom in">+</button>
    </div>
  );
}

export function CustomControls({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className="ex-custom">
      <DocViewer source={deck} theme={theme} showToolbar={false} showSidebar={false}>
        <Controls />
      </DocViewer>
    </div>
  );
}
