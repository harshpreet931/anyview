import type { Annotation } from './types';

export interface SerializedAnnotations {
  readonly version: 1;
  readonly annotations: Annotation[];
}

/** Serialize annotations to a versioned sidecar JSON string. */
export function serializeAnnotations(annotations: Annotation[]): string {
  const payload: SerializedAnnotations = { version: 1, annotations };
  return JSON.stringify(payload);
}

/** Parse a sidecar JSON string back into annotations. Returns [] on malformed input. */
export function parseAnnotations(json: string): Annotation[] {
  try {
    const parsed = JSON.parse(json) as Partial<SerializedAnnotations>;
    return validAnnotations(parsed?.annotations);
  } catch {
    return [];
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (v: unknown) => isObj(v) && isNum(v.x) && isNum(v.y);
const isRect = (v: unknown) => isPoint(v) && isObj(v) && isNum(v.width) && isNum(v.height);

const DATA_CHECKS: Record<string, (d: Record<string, unknown>) => boolean> = {
  highlight: (d) => Array.isArray(d.rects) && d.rects.every(isRect),
  ink: (d) =>
    isNum(d.thickness) &&
    Array.isArray(d.paths) &&
    d.paths.every((p) => Array.isArray(p) && p.every(isPoint)),
  'sticky-note': (d) => isPoint(d) && typeof d.comment === 'string',
  shape: (d) =>
    ['rectangle', 'ellipse', 'line', 'arrow'].includes(d.shape as string) &&
    isPoint(d.from) &&
    isPoint(d.to) &&
    isNum(d.strokeWidth),
  'free-text': (d) => isPoint(d) && typeof d.text === 'string' && isNum(d.fontSize),
};

function isAnnotation(v: unknown): v is Annotation {
  if (!isObj(v) || !isObj(v.data)) return false;
  const check = DATA_CHECKS[v.type as string];
  return (
    !!check &&
    typeof v.id === 'string' &&
    Number.isInteger(v.pageIndex) &&
    (v.pageIndex as number) >= 0 &&
    typeof v.color === 'string' &&
    isNum(v.opacity) &&
    check(v.data)
  );
}

/** Keeps only annotations whose shape the viewer can render; anything else is dropped. */
export function validAnnotations(list: unknown): Annotation[] {
  return Array.isArray(list) ? list.filter(isAnnotation) : [];
}
