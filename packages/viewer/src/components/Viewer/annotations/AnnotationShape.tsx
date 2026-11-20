import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import type { Annotation } from '../../../core/types';
import { useStrings } from '../../../i18n/I18nProvider';
import type { ViewerStrings } from '../../../i18n/types';
import { EDITOR_H, EDITOR_W, pointsToPath, type Point } from './annotation-geometry';
import { ShapeGeometry } from './ShapeGeometry';

const ANNOTATION_LABEL: Record<Annotation['type'], keyof ViewerStrings['annotations']> = {
  highlight: 'highlightItem',
  ink: 'inkItem',
  'sticky-note': 'noteItem',
  shape: 'shapeItem',
  'free-text': 'freeTextItem',
};

export interface AnnotationShapeProps {
  annotation: Annotation;
  width: number;
  height: number;
  selected: boolean;
  interactive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

interface BodyOptions {
  width: number;
  height: number;
  bodyInteractive: boolean;
  pointerStyle: CSSProperties;
  onPointerDown: (e: PointerEvent) => void;
}

function annotationBody(
  annotation: Annotation,
  { width, height, bodyInteractive, pointerStyle, onPointerDown }: BodyOptions,
): { body: ReactNode; anchor: Point } {
  switch (annotation.type) {
    case 'highlight': {
      const first = annotation.data.rects[0];
      return {
        body: annotation.data.rects.map((r, i) => (
          <rect
            key={i}
            x={r.x * width}
            y={r.y * height}
            width={r.width * width}
            height={r.height * height}
            fill={annotation.color}
            opacity={annotation.opacity}
            style={pointerStyle}
            onPointerDown={onPointerDown}
          />
        )),
        anchor: first ? { x: (first.x + first.width) * width, y: first.y * height } : { x: 0, y: 0 },
      };
    }
    case 'ink': {
      const p0 = annotation.data.paths[0]?.[0];
      return {
        body: annotation.data.paths.map((path, i) => (
          <path
            key={i}
            d={pointsToPath(path, width, height)}
            fill="none"
            stroke={annotation.color}
            strokeWidth={annotation.data.thickness * width}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={pointerStyle}
            onPointerDown={onPointerDown}
          />
        )),
        anchor: p0 ? { x: p0.x * width, y: p0.y * height } : { x: 0, y: 0 },
      };
    }
    case 'shape': {
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
      return {
        body: (
          <g>
            <g style={{ pointerEvents: 'none' }}>
              <ShapeGeometry shape={shape} from={from} to={to} color={annotation.color} width={width} height={height} />
            </g>
            {bodyInteractive && (
              <g style={pointerStyle} onPointerDown={onPointerDown}>
                {hit}
              </g>
            )}
          </g>
        ),
        anchor: { x: Math.max(from.x, to.x) * width, y: Math.min(from.y, to.y) * height },
      };
    }
    case 'free-text': {
      const x = annotation.data.x * width;
      const y = annotation.data.y * height;
      return {
        body: (
          <text
            x={x}
            y={y}
            fontSize={annotation.data.fontSize * height}
            fill={annotation.color}
            style={pointerStyle}
            onPointerDown={onPointerDown}
          >
            {annotation.data.text}
          </text>
        ),
        anchor: { x, y: y - annotation.data.fontSize * height },
      };
    }
    case 'sticky-note': {
      const x = annotation.data.x * width;
      const y = annotation.data.y * height;
      return {
        body: (
          <g style={pointerStyle} onPointerDown={onPointerDown}>
            <title>{annotation.data.comment}</title>
            <rect x={x} y={y} width={18} height={18} rx={3} fill={annotation.color} />
            <path
              d={`M ${x + 4} ${y + 6} H ${x + 14} M ${x + 4} ${y + 9} H ${x + 14} M ${x + 4} ${y + 12} H ${x + 10}`}
              stroke="rgba(0,0,0,0.55)"
              strokeWidth={1}
            />
          </g>
        ),
        anchor: { x: x + 18, y },
      };
    }
  }
}

export function AnnotationShape({
  annotation,
  width,
  height,
  selected,
  interactive,
  onSelect,
  onDelete,
}: AnnotationShapeProps) {
  const strings = useStrings();
  const handleClick = (e: PointerEvent) => {
    if (!interactive) return;
    e.stopPropagation();
    onSelect();
  };

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.closest<HTMLElement>('.dv-viewer-container')?.focus({ preventScroll: true });
      onDelete();
    }
  };

  const passesClicksThrough = annotation.type === 'highlight' || annotation.type === 'ink';
  const bodyInteractive = interactive && !passesClicksThrough;
  const pointerStyle = { pointerEvents: bodyInteractive ? 'auto' : 'none' } as const;
  const { body, anchor } = annotationBody(annotation, {
    width,
    height,
    bodyInteractive,
    pointerStyle,
    onPointerDown: handleClick,
  });

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
