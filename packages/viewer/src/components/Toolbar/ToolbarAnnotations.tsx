import { useViewerStore } from '../../hooks/useDocViewer';
import type { AnnotationTool } from '../../core/types';

const ANNOTATION_TOOLS: ReadonlyArray<{
  tool: AnnotationTool;
  label: string;
  path: string;
}> = [
  {
    tool: 'highlight',
    label: 'Highlight',
    path: 'M3 11l6-6 4 4-6 6H3v-4zm0 6h14v-1H3v1z',
  },
  {
    tool: 'ink',
    label: 'Draw',
    path: 'M2 14l1-3 7-7 2 2-7 7-3 1zm9-10l1.5-1.5 2 2L13 6l-2-2z',
  },
  {
    tool: 'rectangle',
    label: 'Rectangle',
    path: 'M2 3h12v10H2V3zm1.5 1.5v7h9v-7h-9z',
  },
  {
    tool: 'ellipse',
    label: 'Ellipse',
    path: 'M8 3c3.6 0 6.5 2.2 6.5 5S11.6 13 8 13 1.5 10.8 1.5 8 4.4 3 8 3zm0 1.5C5.2 4.5 3 6.1 3 8s2.2 3.5 5 3.5 5-1.6 5-3.5-2.2-3.5-5-3.5z',
  },
  {
    tool: 'line',
    label: 'Line',
    path: 'M2.8 12.6l-1-1L12.2 1.2l1 1L2.8 12.6z',
  },
  {
    tool: 'arrow',
    label: 'Arrow',
    path: 'M2.8 12.6l-1-1L10 3.4H6V2h6.5v6.5H11v-4l-8.2 8.1z',
  },
  {
    tool: 'free-text',
    label: 'Text',
    path: 'M2 2h12v3h-1.5V3.5H8.75v9H10V14H6v-1.5h1.25v-9H3.5V5H2V2z',
  },
  {
    tool: 'sticky-note',
    label: 'Note',
    path: 'M3 2h10v8l-3 4H3V2zm7 11v-3h3l-3 3z',
  },
];

export function ToolbarAnnotations() {
  const activeTool = useViewerStore((s) => s.activeAnnotationTool);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);

  return (
    <div
      className="dv-toolbar-group dv-toolbar-annotations"
      role="radiogroup"
      aria-label="Annotation tools"
    >
      {ANNOTATION_TOOLS.map(({ tool, label, path }) => {
        const isActive = activeTool === tool;
        return (
          <button
            key={tool}
            className="dv-button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            data-toggled={isActive}
            onClick={() => setActiveTool(isActive ? null : tool)}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d={path} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
