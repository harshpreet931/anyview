/* ============================================================
 * Annotation Slice
 * Annotation state management with change listeners.
 * ============================================================ */

import type { StateCreator } from 'zustand';
import type {
  Annotation,
  AnnotationType,
  AnnotationChangeListener,
} from '../types';

export interface AnnotationSlice {
  annotations: Annotation[];
  activeAnnotationTool: AnnotationType | null;
  selectedAnnotationId: string | null;

  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (
    id: string,
    patch: Partial<Omit<Annotation, 'id' | 'pageIndex' | 'type'>>,
  ) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  setActiveTool: (tool: AnnotationType | null) => void;
  onAnnotationChange: (cb: AnnotationChangeListener) => () => void;
}

export const createAnnotationSlice: StateCreator<
  AnnotationSlice,
  [],
  [],
  AnnotationSlice
> = (set, get) => {
  const listeners = new Set<AnnotationChangeListener>();

  const notify = (annotations: Annotation[]) => {
    for (const cb of listeners) {
      cb(annotations);
    }
  };

  return {
    annotations: [],
    activeAnnotationTool: null,
    selectedAnnotationId: null,

    addAnnotation: (annotation: Annotation) => {
      const next = [...get().annotations, annotation];
      set({ annotations: next });
      notify(next);
    },

    updateAnnotation: (
      id: string,
      patch: Partial<Omit<Annotation, 'id' | 'pageIndex' | 'type'>>,
    ) => {
      const next = get().annotations.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a,
      ) as Annotation[];
      set({ annotations: next });
      notify(next);
    },

    deleteAnnotation: (id: string) => {
      const next = get().annotations.filter((a) => a.id !== id);
      set({
        annotations: next,
        selectedAnnotationId:
          get().selectedAnnotationId === id ? null : get().selectedAnnotationId,
      });
      notify(next);
    },

    selectAnnotation: (id: string | null) =>
      set({ selectedAnnotationId: id }),

    setActiveTool: (tool: AnnotationType | null) =>
      set({ activeAnnotationTool: tool }),

    onAnnotationChange: (cb: AnnotationChangeListener) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
};
