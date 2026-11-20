import { SHAPE_KINDS, type AnnotationTool, type ShapeKind } from '../../../core/types';

export const TOOL_DEFAULTS = {
  highlight: { color: '#ffd400', opacity: 0.4 },
  ink: { color: '#ef4444', opacity: 1 },
  'sticky-note': { color: '#fbbf24', opacity: 1 },
  shape: { color: '#e8551f', opacity: 1 },
  'free-text': { color: '#121110', opacity: 1 },
} as const;

export type TextTool = 'sticky-note' | 'free-text';

const shapeTools: ReadonlySet<AnnotationTool | null> = new Set(SHAPE_KINDS);

export const isShapeTool = (t: AnnotationTool | null): t is ShapeKind => shapeTools.has(t);
