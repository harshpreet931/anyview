import { useViewerStore } from '../../hooks/useDocViewer';
import type { AnnotationTool } from '../../core/types';
import { useStrings } from '../../i18n/I18nProvider';
import type { ViewerStrings } from '../../i18n/types';
import { IconButton } from './IconButton';

const ANNOTATION_TOOLS: ReadonlyArray<{
  tool: AnnotationTool;
  labelKey: keyof ViewerStrings['annotations'];
}> = [
  { tool: 'highlight', labelKey: 'highlight' },
  { tool: 'ink', labelKey: 'draw' },
  { tool: 'rectangle', labelKey: 'rectangle' },
  { tool: 'ellipse', labelKey: 'ellipse' },
  { tool: 'line', labelKey: 'line' },
  { tool: 'arrow', labelKey: 'arrow' },
  { tool: 'free-text', labelKey: 'freeText' },
  { tool: 'sticky-note', labelKey: 'note' },
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
      {ANNOTATION_TOOLS.map(({ tool, labelKey }) => {
        const isActive = activeTool === tool;
        return (
          <IconButton
            key={tool}
            icon={tool}
            label={strings.annotations[labelKey]}
            role="radio"
            aria-checked={isActive}
            data-toggled={isActive}
            onClick={() => setActiveTool(isActive ? null : tool)}
          />
        );
      })}
    </div>
  );
}
