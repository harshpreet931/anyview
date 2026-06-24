/* ============================================================
 * AnnotationLayer — SVG overlay that renders and edits the
 * annotations for one page. Supports highlight (drag a box),
 * ink (freehand), and sticky-note (click to place) tools.
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
} as const;

const INK_THICKNESS = 0.004; // fraction of page width

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `a-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
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
  const [draftRect, setDraftRect] = useState<null | {
    x: number;
    y: number;
    w: number;
    h: number;
  }>(null);
  const [draftPath, setDraftPath] = useState<Point[]>([]);

  const isDrawingTool =
    activeTool === 'highlight' || activeTool === 'ink' || activeTool === 'sticky-note';

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

    drawingRef.current = true;
    startRef.current = pt;
    if (activeTool === 'ink') setDraftPath([pt]);
    else setDraftRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!drawingRef.current || !startRef.current) return;
    const pt = toPoint(e);
    if (activeTool === 'ink') {
      setDraftPath((prev) => [...prev, pt]);
    } else {
      const s = startRef.current;
      setDraftRect({
        x: Math.min(s.x, pt.x),
        y: Math.min(s.y, pt.y),
        w: Math.abs(pt.x - s.x),
        h: Math.abs(pt.y - s.y),
      });
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
    } else if (draftRect && draftRect.w > 0.002 && draftRect.h > 0.002) {
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
            { x: draftRect.x, y: draftRect.y, width: draftRect.w, height: draftRect.h },
          ],
        },
      };
      addAnnotation(hl);
      setDraftRect(null);
    } else {
      setDraftRect(null);
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
      {draftRect && (
        <rect
          x={draftRect.x * width}
          y={draftRect.y * height}
          width={draftRect.w * width}
          height={draftRect.h * height}
          fill={TOOL_DEFAULTS.highlight.color}
          opacity={TOOL_DEFAULTS.highlight.opacity}
        />
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

function pointsToPath(points: Point[], width: number, height: number): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * width} ${p.y * height}`)
    .join(' ');
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

  // Highlight and ink shapes lie directly over document text. If their fills
  // captured the pointer they would swallow the mousedown that begins a text
  // selection, so they stay non-interactive — users select the text beneath.
  // Sticky-note icons sit off the text flow and remain clickable.
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
