/* ============================================================
 * Annotation serialization
 * Sidecar JSON format for persisting / restoring annotations.
 * ============================================================ */

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
    if (parsed && Array.isArray(parsed.annotations)) {
      return parsed.annotations;
    }
    return [];
  } catch {
    return [];
  }
}
