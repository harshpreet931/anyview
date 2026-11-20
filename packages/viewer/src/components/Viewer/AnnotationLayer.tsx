import { isSidewaysRotation } from '../../core/rotation';
import { useViewerStore } from '../../hooks/useDocViewer';
import { INK_THICKNESS, pointsToPath, rotateTransform } from './annotations/annotation-geometry';
import { TOOL_DEFAULTS, isShapeTool } from './annotations/annotation-tools';
import { AnnotationEditor } from './annotations/AnnotationEditor';
import { AnnotationShape } from './annotations/AnnotationShape';
import { ShapeGeometry } from './annotations/ShapeGeometry';
import { useAnnotationDraft } from './annotations/useAnnotationDraft';

export interface AnnotationLayerProps {
  pageIndex: number;
  width: number;
  height: number;
}

export function AnnotationLayer({ pageIndex, width, height }: AnnotationLayerProps) {
  const annotations = useViewerStore((s) => s.annotations);
  const selectedId = useViewerStore((s) => s.selectedAnnotationId);
  const deleteAnnotation = useViewerStore((s) => s.deleteAnnotation);
  const selectAnnotation = useViewerStore((s) => s.selectAnnotation);
  const turn = useViewerStore((s) => s.rotation);
  const { svgRef, activeTool, draftBox, draftPath, editor, commitEditor, closeEditor, pointerHandlers } =
    useAnnotationDraft(pageIndex, turn);

  const isDrawingTool = activeTool !== null;
  const sideways = isSidewaysRotation(turn);
  const pageW = sideways ? height : width;
  const pageH = sideways ? width : height;
  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIndex);

  return (
    <svg
      ref={svgRef}
      className="dv-annotation-layer"
      width={width}
      height={height}
      style={{ pointerEvents: isDrawingTool ? 'auto' : 'none', touchAction: 'none' }}
      data-tool={activeTool ?? undefined}
      {...pointerHandlers}
    >
      <g transform={rotateTransform(turn, width, height)}>
        {pageAnnotations.map((a) => (
          <AnnotationShape
            key={a.id}
            annotation={a}
            width={pageW}
            height={pageH}
            selected={a.id === selectedId}
            interactive={!isDrawingTool}
            onSelect={() => selectAnnotation(a.id)}
            onDelete={() => deleteAnnotation(a.id)}
          />
        ))}
        {draftBox && activeTool === 'highlight' && (
          <rect
            x={Math.min(draftBox.from.x, draftBox.to.x) * pageW}
            y={Math.min(draftBox.from.y, draftBox.to.y) * pageH}
            width={Math.abs(draftBox.to.x - draftBox.from.x) * pageW}
            height={Math.abs(draftBox.to.y - draftBox.from.y) * pageH}
            fill={TOOL_DEFAULTS.highlight.color}
            opacity={TOOL_DEFAULTS.highlight.opacity}
          />
        )}
        {draftBox && isShapeTool(activeTool) && (
          <ShapeGeometry
            shape={activeTool}
            from={draftBox.from}
            to={draftBox.to}
            color={TOOL_DEFAULTS.shape.color}
            width={pageW}
            height={pageH}
          />
        )}
        {draftPath.length > 1 && (
          <path
            d={pointsToPath(draftPath, pageW, pageH)}
            fill="none"
            stroke={TOOL_DEFAULTS.ink.color}
            strokeWidth={INK_THICKNESS * pageW}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </g>
      {editor && (
        <AnnotationEditor
          editor={editor}
          turn={turn}
          width={width}
          height={height}
          onCommit={commitEditor}
          onCancel={closeEditor}
        />
      )}
    </svg>
  );
}
