/* ============================================================
 * AnnotationLayer — SVG overlay that renders and edits the
 * annotations for one page. Tools: highlight (drag a box), ink
 * (freehand), sticky-note (click), shapes — rectangle / ellipse /
 * line / arrow (drag), and free-text (click).
 *
 * All geometry is stored normalized (0–1) so annotations stay
 * anchored across zoom and re-render without re-rasterizing.
 * ============================================================ */

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type {
  Annotation,
  HighlightAnnotation,
  InkAnnotation,
  StickyNoteAnnotation,
  ShapeAnnotation,
  ShapeKind,
  FreeTextAnnotation,
} from '../../core/types';
import { useViewerStore } from '../../hooks/useDocViewer';

export interface AnnotationLayerProps {
  pageIndex: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

const TOOL_DEFAULTS = {
  highlight: { color: '#ffd400', opacity: 0.4 },
  ink: { color: '#ef4444', opacity: 1 },
  'sticky-note': { color: '#fbbf24', opacity: 1 },
  shape: { color: '#2563eb', opacity: 1 },
  'free-text': { color: '#111827', opacity: 1 },
} as const;

const INK_THICKNESS = 0.004; // fraction of page width
const SHAPE_STROKE = 0.003; // fraction of page width
const FREE_TEXT_SIZE = 0.024; // fraction of page height

const SHAPE_TOOLS = ['rectangle', 'ellipse', 'line', 'arrow'] as const;
type ShapeTool = (typeof SHAPE_TOOLS)[number];
const isShapeTool = (t: unknown): t is ShapeTool =>
  SHAPE_TOOLS.includes(t as ShapeTool);

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `a-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function pointsToPath(points: Point[], width: number, height: number): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * width} ${p.y * height}`)
    .join(' ');
}

/** Render a shape (rectangle/ellipse/line/arrow) from two normalized points. */
function renderShapeGeometry(
  shape: ShapeKind,
  from: Point,
  to: Point,
  color: string,
  width: number,
  height: number,
): React.ReactNode {
  const stroke = SHAPE_STROKE * width;
  const x1 = from.x * width;
  const y1 = from.y * height;
  const x2 = to.x * width;
  const y2 = to.y * height;
  const common = {
    stroke: color,
    strokeWidth: stroke,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
  };
  if (shape === 'rectangle') {
    return (
      <rect
        x={Math.min(x1, x2)}
        y={Math.min(y1, y2)}
        width={Math.abs(x2 - x1)}
        height={Math.abs(y2 - y1)}
        {...common}
      />
    );
  }
  if (shape === 'ellipse') {
    return (
      <ellipse
        cx={(x1 + x2) / 2}
        cy={(y1 + y2) / 2}
        rx={Math.abs(x2 - x1) / 2}
        ry={Math.abs(y2 - y1) / 2}
        {...common}
      />
    );
  }
  // line / arrow
  const line = <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} />;
  if (shape === 'line') return line;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = stroke * 3 + 5;
  const a1x = x2 - head * Math.cos(angle - 0.45);
  const a1y = y2 - head * Math.sin(angle - 0.45);
  const a2x = x2 - head * Math.cos(angle + 0.45);
  const a2y = y2 - head * Math.sin(angle + 0.45);
  return (
    <g>
      {line}
      <polygon points={`${x2},${y2} ${a1x},${a1y} ${a2x},${a2y}`} fill={color} />
    </g>
  );
}

export function AnnotationLayer({ pageIndex, width, height }: AnnotationLayerProps) {
  const annotations = useViewerStore((s) => s.annotations);
  const activeTool = useViewerStore((s) => s.activeAnnotationTool);
  const selectedId = useViewerStore((s) => s.selectedAnnotationId);
  const addAnnotation = useViewerStore((s) => s.addAnnotation);
  const deleteAnnotation = useViewerStore((s) => s.deleteAnnotation);
  const selectAnnotation = useViewerStore((s) => s.selectAnnotation);

  const svgRef = useRef<SVGSVGElement>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<Point | null>(null);
  const [draftBox, setDraftBox] = useState<{ from: Point; to: Point } | null>(null);
  const [draftPath, setDraftPath] = useState<Point[]>([]);

  const isDrawingTool = activeTool !== null;

  const toPoint = (e: ReactPointerEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e: ReactPointerEvent) => {
    if (!isDrawingTool) return;
    e.preventDefault();
    const pt = toPoint(e);
    svgRef.current?.setPointerCapture(e.pointerId);

    if (activeTool === 'sticky-note') {
      const comment = window.prompt('Note');
      if (comment != null && comment.trim()) {
        const note: StickyNoteAnnotation = {
          id: newId(),
          pageIndex,
          type: 'sticky-note',
          color: TOOL_DEFAULTS['sticky-note'].color,
          opacity: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: { x: pt.x, y: pt.y, comment: comment.trim() },
        };
        addAnnotation(note);
      }
      return;
    }

    if (activeTool === 'free-text') {
      const text = window.prompt('Text');
      if (text != null && text.trim()) {
        const ann: FreeTextAnnotation = {
          id: newId(),
          pageIndex,
          type: 'free-text',
          color: TOOL_DEFAULTS['free-text'].color,
          opacity: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: { x: pt.x, y: pt.y, text: text.trim(), fontSize: FREE_TEXT_SIZE },
        };
        addAnnotation(ann);
      }
      return;
    }

    drawingRef.current = true;
    startRef.current = pt;
    if (activeTool === 'ink') setDraftPath([pt]);
    else setDraftBox({ from: pt, to: pt });
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!drawingRef.current || !startRef.current) return;
    const pt = toPoint(e);
    if (activeTool === 'ink') {
      setDraftPath((prev) => [...prev, pt]);
    } else {
      setDraftBox({ from: startRef.current, to: pt });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    svgRef.current?.releasePointerCapture(e.pointerId);

    if (activeTool === 'ink') {
      if (draftPath.length > 1) {
        const ink: InkAnnotation = {
          id: newId(),
          pageIndex,
          type: 'ink',
          color: TOOL_DEFAULTS.ink.color,
          opacity: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: { paths: [draftPath], thickness: INK_THICKNESS },
        };
        addAnnotation(ink);
      }
      setDraftPath([]);
    } else if (draftBox && startRef.current) {
      const from = startRef.current;
      const to = draftBox.to;
      const dx = Math.abs(to.x - from.x);
      const dy = Math.abs(to.y - from.y);

      if (isShapeTool(activeTool) && Math.hypot(dx, dy) > 0.005) {
        const shape: ShapeAnnotation = {
          id: newId(),
          pageIndex,
          type: 'shape',
          color: TOOL_DEFAULTS.shape.color,
          opacity: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: { shape: activeTool, from, to, strokeWidth: SHAPE_STROKE },
        };
        addAnnotation(shape);
      } else if (activeTool === 'highlight' && dx > 0.002 && dy > 0.002) {
        const hl: HighlightAnnotation = {
          id: newId(),
          pageIndex,
          type: 'highlight',
          color: TOOL_DEFAULTS.highlight.color,
          opacity: TOOL_DEFAULTS.highlight.opacity,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: {
            rects: [
              {
                x: Math.min(from.x, to.x),
                y: Math.min(from.y, to.y),
                width: dx,
                height: dy,
              },
            ],
          },
        };
        addAnnotation(hl);
      }
      setDraftBox(null);
    }
    startRef.current = null;
  };

  const pageAnnotations = annotations.filter((a) => a.pageIndex === pageIndex);

  return (
    <svg
      ref={svgRef}
      className="dv-annotation-layer"
      width={width}
      height={height}
      style={{ pointerEvents: isDrawingTool ? 'auto' : 'none', touchAction: 'none' }}
      data-tool={activeTool ?? undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {pageAnnotations.map((a) => (
        <AnnotationShape
          key={a.id}
          annotation={a}
          width={width}
          height={height}
          selected={a.id === selectedId}
          interactive={!isDrawingTool}
          onSelect={() => selectAnnotation(a.id)}
          onDelete={() => deleteAnnotation(a.id)}
        />
      ))}

      {/* In-progress draft */}
      {draftBox && activeTool === 'highlight' && (
        <rect
          x={Math.min(draftBox.from.x, draftBox.to.x) * width}
          y={Math.min(draftBox.from.y, draftBox.to.y) * height}
          width={Math.abs(draftBox.to.x - draftBox.from.x) * width}
          height={Math.abs(draftBox.to.y - draftBox.from.y) * height}
          fill={TOOL_DEFAULTS.highlight.color}
          opacity={TOOL_DEFAULTS.highlight.opacity}
        />
      )}
      {draftBox && isShapeTool(activeTool) &&
        renderShapeGeometry(
          activeTool,
          draftBox.from,
          draftBox.to,
          TOOL_DEFAULTS.shape.color,
          width,
          height,
        )}
      {draftPath.length > 1 && (
        <path
          d={pointsToPath(draftPath, width, height)}
          fill="none"
          stroke={TOOL_DEFAULTS.ink.color}
          strokeWidth={INK_THICKNESS * width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function AnnotationShape({
  annotation,
  width,
  height,
  selected,
  interactive,
  onSelect,
  onDelete,
}: {
  annotation: Annotation;
  width: number;
  height: number;
  selected: boolean;
  interactive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const handleClick = (e: ReactPointerEvent) => {
    if (!interactive) return;
    e.stopPropagation();
    onSelect();
  };

  // Highlight and ink lie over document text; keeping them non-interactive lets
  // users select the text beneath. Shapes, notes, and free-text are clickable.
  const isTextOverlay =
    annotation.type === 'highlight' || annotation.type === 'ink';
  const bodyInteractive = interactive && !isTextOverlay;
  const pointerStyle = { pointerEvents: bodyInteractive ? 'auto' : 'none' } as const;

  let body: React.ReactNode = null;
  let anchor = { x: 0, y: 0 };

  if (annotation.type === 'highlight') {
    body = annotation.data.rects.map((r, i) => (
      <rect
        key={i}
        x={r.x * width}
        y={r.y * height}
        width={r.width * width}
        height={r.height * height}
        fill={annotation.color}
        opacity={annotation.opacity}
        style={pointerStyle}
        onPointerDown={handleClick}
      />
    ));
    const first = annotation.data.rects[0];
    if (first) anchor = { x: (first.x + first.width) * width, y: first.y * height };
  } else if (annotation.type === 'ink') {
    body = annotation.data.paths.map((path, i) => (
      <path
        key={i}
        d={pointsToPath(path as Point[], width, height)}
        fill="none"
        stroke={annotation.color}
        strokeWidth={annotation.data.thickness * width}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={pointerStyle}
        onPointerDown={handleClick}
      />
    ));
    const p0 = annotation.data.paths[0]?.[0];
    if (p0) anchor = { x: p0.x * width, y: p0.y * height };
  } else if (annotation.type === 'shape') {
    const { shape, from, to } = annotation.data;
    body = (
      <g style={pointerStyle} onPointerDown={handleClick}>
        {/* A wider transparent hit line over the geometry makes thin shapes selectable. */}
        {renderShapeGeometry(shape, from, to, annotation.color, width, height)}
      </g>
    );
    anchor = { x: Math.max(from.x, to.x) * width, y: Math.min(from.y, to.y) * height };
  } else if (annotation.type === 'free-text') {
    const x = annotation.data.x * width;
    const y = annotation.data.y * height;
    anchor = { x, y: y - annotation.data.fontSize * height };
    body = (
      <text
        x={x}
        y={y}
        fontSize={annotation.data.fontSize * height}
        fill={annotation.color}
        style={pointerStyle}
        onPointerDown={handleClick}
      >
        {annotation.data.text}
      </text>
    );
  } else if (annotation.type === 'sticky-note') {
    const x = annotation.data.x * width;
    const y = annotation.data.y * height;
    anchor = { x: x + 18, y };
    body = (
      <g style={pointerStyle} onPointerDown={handleClick}>
        <title>{annotation.data.comment}</title>
        <rect x={x} y={y} width={18} height={18} rx={3} fill={annotation.color} />
        <path
          d={`M ${x + 4} ${y + 6} H ${x + 14} M ${x + 4} ${y + 9} H ${x + 14} M ${x + 4} ${y + 12} H ${x + 10}`}
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={1}
        />
      </g>
    );
  }

  return (
    <g className="dv-annotation" data-selected={selected || undefined}>
      {body}
      {selected && interactive && (
        <g
          className="dv-annotation-delete"
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <circle cx={anchor.x + 6} cy={anchor.y - 6} r={8} fill="#ef4444" />
          <path
            d={`M ${anchor.x + 3} ${anchor.y - 9} L ${anchor.x + 9} ${anchor.y - 3} M ${anchor.x + 9} ${anchor.y - 9} L ${anchor.x + 3} ${anchor.y - 3}`}
            stroke="white"
            strokeWidth={1.5}
          />
        </g>
      )}
    </g>
  );
}
