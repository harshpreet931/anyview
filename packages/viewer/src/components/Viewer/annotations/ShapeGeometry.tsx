import type { ShapeKind } from '../../../core/types';
import { SHAPE_STROKE, type Point } from './annotation-geometry';

export interface ShapeGeometryProps {
  shape: ShapeKind;
  from: Point;
  to: Point;
  color: string;
  width: number;
  height: number;
}

export function ShapeGeometry({ shape, from, to, color, width, height }: ShapeGeometryProps) {
  const stroke = SHAPE_STROKE * width;
  const x1 = from.x * width;
  const y1 = from.y * height;
  const x2 = to.x * width;
  const y2 = to.y * height;
  const common = {
    stroke: color,
    strokeWidth: stroke,
    fill: 'none',
    strokeLinecap: 'round',
  } as const;
  switch (shape) {
    case 'rectangle':
      return (
        <rect
          x={Math.min(x1, x2)}
          y={Math.min(y1, y2)}
          width={Math.abs(x2 - x1)}
          height={Math.abs(y2 - y1)}
          {...common}
        />
      );
    case 'ellipse':
      return (
        <ellipse
          cx={(x1 + x2) / 2}
          cy={(y1 + y2) / 2}
          rx={Math.abs(x2 - x1) / 2}
          ry={Math.abs(y2 - y1) / 2}
          {...common}
        />
      );
    case 'line':
      return <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} />;
    case 'arrow':
    default: {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = stroke * 3 + 5;
      const a1x = x2 - head * Math.cos(angle - 0.45);
      const a1y = y2 - head * Math.sin(angle - 0.45);
      const a2x = x2 - head * Math.cos(angle + 0.45);
      const a2y = y2 - head * Math.sin(angle + 0.45);
      return (
        <g>
          <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} />
          <polygon points={`${x2},${y2} ${a1x},${a1y} ${a2x},${a2y}`} fill={color} />
        </g>
      );
    }
  }
}
