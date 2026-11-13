import { useViewerStore } from '../../hooks/useDocViewer';
import type { AnnotationTool } from '../../core/types';
import { Icon } from '../common/Icon';

const ANNOTATION_TOOLS: ReadonlyArray<{
  tool: AnnotationTool;
  label: string;
}> = [
  { tool: 'highlight', label: 'Highlight' },
  { tool: 'ink', label: 'Draw' },
  { tool: 'rectangle', label: 'Rectangle' },
  { tool: 'ellipse', label: 'Ellipse' },
  { tool: 'line', label: 'Line' },
  { tool: 'arrow', label: 'Arrow' },
  { tool: 'free-text', label: 'Text' },
  { tool: 'sticky-note', label: 'Note' },
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
      {ANNOTATION_TOOLS.map(({ tool, label }) => {
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
            <Icon name={tool} />
          </button>
        );
      })}
    </div>
  );
}
