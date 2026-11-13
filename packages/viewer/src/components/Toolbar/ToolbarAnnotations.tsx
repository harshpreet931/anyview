import { useViewerStore } from '../../hooks/useDocViewer';
import type { AnnotationTool } from '../../core/types';
import { Icon } from '../common/Icon';
import { useStrings } from '../../i18n/I18nProvider';
import type { ViewerStrings } from '../../i18n/types';

const ANNOTATION_TOOLS: ReadonlyArray<{
  tool: AnnotationTool;
  label: keyof ViewerStrings['annotations'];
}> = [
  { tool: 'highlight', label: 'highlight' },
  { tool: 'ink', label: 'draw' },
  { tool: 'rectangle', label: 'rectangle' },
  { tool: 'ellipse', label: 'ellipse' },
  { tool: 'line', label: 'line' },
  { tool: 'arrow', label: 'arrow' },
  { tool: 'free-text', label: 'freeText' },
  { tool: 'sticky-note', label: 'note' },
];

export function ToolbarAnnotations() {
  const strings = useStrings();
  const activeTool = useViewerStore((s) => s.activeAnnotationTool);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);

  return (
    <div
      className="dv-toolbar-group dv-toolbar-annotations"
      role="radiogroup"
      aria-label={strings.toolbar.annotationTools}
    >
      {ANNOTATION_TOOLS.map(({ tool, label: key }) => {
        const label = strings.annotations[key];
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
