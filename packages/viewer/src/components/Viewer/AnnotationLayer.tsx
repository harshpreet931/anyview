import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
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
import { useStrings } from '../../i18n/I18nProvider';
import type { ViewerStrings } from '../../i18n/types';

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
  shape: { color: '#e8551f', opacity: 1 },
  'free-text': { color: '#121110', opacity: 1 },
} as const;

const INK_THICKNESS = 0.004;
const SHAPE_STROKE = 0.003;
const FREE_TEXT_SIZE = 0.024;

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

type Rect = { x: number; y: number; width: number; height: number };

const LINE_HIGHLIGHT_HEIGHT = 0.016;

type QuarterTurn = 0 | 90 | 180 | 270;

/** Stored geometry is in the unrotated page; these map it to and from what is on screen. */
function toPage(p: Point, turn: QuarterTurn): Point {
  if (turn === 90) return { x: p.y, y: 1 - p.x };
  if (turn === 180) return { x: 1 - p.x, y: 1 - p.y };
  if (turn === 270) return { x: 1 - p.y, y: p.x };
  return p;
}

function toScreen(p: Point, turn: QuarterTurn): Point {
  if (turn === 90) return { x: 1 - p.y, y: p.x };
  if (turn === 180) return { x: 1 - p.x, y: 1 - p.y };
  if (turn === 270) return { x: p.y, y: 1 - p.x };
  return p;
}

function rotateTransform(turn: QuarterTurn, width: number, height: number): string | undefined {
  if (turn === 90) return `translate(${width} 0) rotate(90)`;
  if (turn === 180) return `translate(${width} ${height}) rotate(180)`;
  if (turn === 270) return `translate(0 ${height}) rotate(270)`;
  return undefined;
}

/** Turns a near-horizontal drag into highlight rects that cover the text it crossed. */
function lineHighlightRects(svg: SVGSVGElement, from: Point, to: Point, turn: QuarterTurn): Rect[] {
  const page = svg.getBoundingClientRect();
  const left = Math.min(from.x, to.x);
  const right = Math.max(from.x, to.x);
  const y = (from.y + to.y) / 2;
  const rects: Rect[] = [];
  const spans = svg.parentElement?.querySelectorAll<HTMLElement>('.dv-text-layer span') ?? [];
  for (const span of spans) {
    const b = span.getBoundingClientRect();
    if (!b.width || !b.height || !page.width || !page.height) continue;
    const a = toPage({ x: (b.left - page.left) / page.width, y: (b.top - page.top) / page.height }, turn);
    const c = toPage({ x: (b.right - page.left) / page.width, y: (b.bottom - page.top) / page.height }, turn);
    const r = {
      x: Math.min(a.x, c.x),
      y: Math.min(a.y, c.y),
      width: Math.abs(c.x - a.x),
      height: Math.abs(c.y - a.y),
    };
    if (y < r.y || y > r.y + r.height || r.x > right || r.x + r.width < left) continue;
    const x = Math.max(r.x, left);
    rects.push({ x, y: r.y, width: Math.min(r.x + r.width, right) - x, height: r.height });
  }
  if (rects.length > 0) return rects;
  return [{ x: left, y: y - LINE_HIGHLIGHT_HEIGHT / 2, width: right - left, height: LINE_HIGHLIGHT_HEIGHT }];
}

type TextTool = 'sticky-note' | 'free-text';
const EDITOR_W = 220;
const EDITOR_H = 84;

export function AnnotationLayer({ pageIndex, width, height }: AnnotationLayerProps) {
  const strings = useStrings();
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
  const [editor, setEditor] = useState<{ tool: TextTool; at: Point } | null>(null);
  const pointersRef = useRef(new Set<number>());
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editor) editorRef.current?.focus({ preventScroll: true });
  }, [editor]);

  const isDrawingTool = activeTool !== null;
  const rotation = useViewerStore((s) => s.rotation);
  const turn = (((rotation % 360) + 360) % 360) as QuarterTurn;
  const sideways = turn === 90 || turn === 270;
  const pageW = sideways ? height : width;
  const pageH = sideways ? width : height;

  const cancelDraft = () => {
    drawingRef.current = false;
    startRef.current = null;
    setDraftBox(null);
    setDraftPath([]);
  };

  const commitEditor = (text: string) => {
    if (!editor) return;
    setEditor(null);
    const value = text.trim();
    if (!value) return;
    const { tool, at } = editor;
    const base = {
      id: newId(),
      pageIndex,
      color: TOOL_DEFAULTS[tool].color,
      opacity: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (tool === 'sticky-note') {
      const note: StickyNoteAnnotation = {
        ...base,
        type: 'sticky-note',
        data: { x: at.x, y: at.y, comment: value },
      };
      addAnnotation(note);
    } else {
      const ann: FreeTextAnnotation = {
        ...base,
        type: 'free-text',
        data: { x: at.x, y: at.y, text: value, fontSize: FREE_TEXT_SIZE },
      };
      addAnnotation(ann);
    }
  };

  const toPoint = (e: ReactPointerEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return toPage(
      {
        x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
      },
      turn,
    );
  };

  const handlePointerDown = (e: ReactPointerEvent) => {
    if (!isDrawingTool) return;
    pointersRef.current.add(e.pointerId);
    if (pointersRef.current.size > 1) {
      cancelDraft();
      return;
    }
    e.preventDefault();
    const pt = toPoint(e);

    if (activeTool === 'sticky-note' || activeTool === 'free-text') {
      if (!editor) setEditor({ tool: activeTool, at: pt });
      return;
    }

    svgRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    startRef.current = pt;
    if (activeTool === 'ink') setDraftPath([pt]);
    else setDraftBox({ from: pt, to: pt });
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!drawingRef.current || !startRef.current || pointersRef.current.size > 1) return;
    const pt = toPoint(e);
    if (activeTool === 'ink') {
      setDraftPath((prev) => [...prev, pt]);
    } else {
      setDraftBox({ from: startRef.current, to: pt });
    }
  };

  const handlePointerEnd = (e: ReactPointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (drawingRef.current && e.type === 'pointercancel') cancelDraft();
  };

  const handlePointerUp = (e: ReactPointerEvent) => {
    handlePointerEnd(e);
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
      } else if (activeTool === 'highlight' && dx > 0.01 && dy <= 0.01 && svgRef.current) {
        const hl: HighlightAnnotation = {
          id: newId(),
          pageIndex,
          type: 'highlight',
          color: TOOL_DEFAULTS.highlight.color,
          opacity: TOOL_DEFAULTS.highlight.opacity,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: { rects: lineHighlightRects(svgRef.current, from, to, turn) },
        };
        addAnnotation(hl);
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
      onPointerCancel={handlePointerEnd}
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
      {draftBox && isShapeTool(activeTool) &&
        renderShapeGeometry(
          activeTool,
          draftBox.from,
          draftBox.to,
          TOOL_DEFAULTS.shape.color,
          pageW,
          pageH,
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
        <foreignObject
          x={Math.min(toScreen(editor.at, turn).x * width, Math.max(0, width - EDITOR_W))}
          y={Math.min(toScreen(editor.at, turn).y * height, Math.max(0, height - EDITOR_H))}
          width={EDITOR_W}
          height={EDITOR_H}
          style={{ pointerEvents: 'auto' }}
        >
          <textarea
            className="dv-annotation-editor"
            ref={editorRef}
            aria-label={editor.tool === 'sticky-note' ? strings.annotations.note : strings.annotations.freeText}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => commitEditor(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setEditor(null);
              } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                commitEditor(e.currentTarget.value);
              }
            }}
          />
        </foreignObject>
      )}
    </svg>
  );
}

const ANNOTATION_LABEL: Record<Annotation['type'], keyof ViewerStrings['annotations']> = {
  highlight: 'highlightItem',
  ink: 'inkItem',
  'sticky-note': 'noteItem',
  shape: 'shapeItem',
  'free-text': 'freeTextItem',
};

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
  const strings = useStrings();
  const handleClick = (e: ReactPointerEvent) => {
    if (!interactive) return;
    e.stopPropagation();
    onSelect();
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as Element)
        .closest<HTMLElement>('.dv-viewer-container')
        ?.focus({ preventScroll: true });
      onDelete();
    }
  };

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
    const x1 = from.x * width;
    const y1 = from.y * height;
    const x2 = to.x * width;
    const y2 = to.y * height;
    const hit =
      shape === 'line' || shape === 'arrow' ? (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
      ) : (
        <rect
          x={Math.min(x1, x2)}
          y={Math.min(y1, y2)}
          width={Math.abs(x2 - x1)}
          height={Math.abs(y2 - y1)}
          fill="transparent"
          stroke="transparent"
          strokeWidth={14}
        />
      );
    body = (
      <g>
        <g style={{ pointerEvents: 'none' }}>
          {renderShapeGeometry(shape, from, to, annotation.color, width, height)}
        </g>
        {bodyInteractive && (
          <g style={pointerStyle} onPointerDown={handleClick}>
            {hit}
          </g>
        )}
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
    <g
      className="dv-annotation"
      data-selected={selected || undefined}
      tabIndex={interactive ? 0 : -1}
      role="button"
      aria-label={strings.annotations[ANNOTATION_LABEL[annotation.type]]}
      aria-pressed={selected}
      onFocus={interactive ? onSelect : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      {body}
      {selected && annotation.type === 'sticky-note' && (
        <foreignObject
          x={Math.min(anchor.x + 6, Math.max(0, width - EDITOR_W))}
          y={anchor.y + 22}
          width={EDITOR_W}
          height={EDITOR_H}
          style={{ pointerEvents: 'none' }}
        >
          <div className="dv-annotation-comment">{annotation.data.comment}</div>
        </foreignObject>
      )}
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
