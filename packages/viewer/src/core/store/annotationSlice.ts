import type { StateCreator } from 'zustand';
import type {
  Annotation,
  AnnotationTool,
  AnnotationChangeListener,
} from '../types';

export interface AnnotationSlice {
  annotations: Annotation[];
  activeAnnotationTool: AnnotationTool | null;
  selectedAnnotationId: string | null;

  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (
    id: string,
    patch: Partial<Omit<Annotation, 'id' | 'pageIndex' | 'type'>>,
  ) => void;
  deleteAnnotation: (id: string) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  clearAnnotations: () => void;
  selectAnnotation: (id: string | null) => void;
  setActiveTool: (tool: AnnotationTool | null) => void;
  onAnnotationChange: (cb: AnnotationChangeListener) => () => void;
  /** Reverts the last add, update or delete. Returns false when there is nothing to undo. */
  undoAnnotation: () => boolean;
  _resetAnnotations: () => void;
}

const HISTORY_LIMIT = 100;

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

  let history: Annotation[][] = [];
  const remember = () => {
    history.push(get().annotations);
    if (history.length > HISTORY_LIMIT) history.shift();
  };

  return {
    annotations: [],
    activeAnnotationTool: null,
    selectedAnnotationId: null,

    addAnnotation: (annotation: Annotation) => {
      remember();
      const next = [...get().annotations, annotation];
      set({ annotations: next });
      notify(next);
    },

    updateAnnotation: (
      id: string,
      patch: Partial<Omit<Annotation, 'id' | 'pageIndex' | 'type'>>,
    ) => {
      if (!get().annotations.some((a) => a.id === id)) return;
      remember();
      const next = get().annotations.map((a) =>
        a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a,
      ) as Annotation[];
      set({ annotations: next });
      notify(next);
    },

    deleteAnnotation: (id: string) => {
      if (!get().annotations.some((a) => a.id === id)) return;
      remember();
      const next = get().annotations.filter((a) => a.id !== id);
      set({
        annotations: next,
        selectedAnnotationId:
          get().selectedAnnotationId === id ? null : get().selectedAnnotationId,
      });
      notify(next);
    },

    setAnnotations: (annotations: Annotation[]) => {
      const next = [...annotations];
      history = [];
      set({ annotations: next, selectedAnnotationId: null });
      notify(next);
    },

    clearAnnotations: () => {
      const had = get().annotations.length > 0;
      set({ annotations: [], selectedAnnotationId: null });
      if (had) notify([]);
    },

    selectAnnotation: (id: string | null) =>
      set({ selectedAnnotationId: id }),

    setActiveTool: (tool: AnnotationTool | null) =>
      set({ activeAnnotationTool: tool }),

    onAnnotationChange: (cb: AnnotationChangeListener) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    undoAnnotation: () => {
      const prev = history.pop();
      if (!prev) return false;
      const selected = get().selectedAnnotationId;
      set({
        annotations: prev,
        selectedAnnotationId: prev.some((a) => a.id === selected) ? selected : null,
      });
      notify(prev);
      return true;
    },

    _resetAnnotations: () => {
      history = [];
      const had = get().annotations.length > 0;
      set({
        annotations: [],
        selectedAnnotationId: null,
        activeAnnotationTool: null,
      });
      if (had) notify([]);
    },
  };
};
