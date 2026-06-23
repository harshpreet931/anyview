/* ============================================================
 * Viewport Slice
 * Zoom, rotation, scroll mode, spread mode, fullscreen.
 * ============================================================ */

import type { StateCreator } from 'zustand';
import type {
  FitMode,
  ScrollMode,
  SpreadMode,
  CursorMode,
} from '../types';

export interface ViewportSlice {
  zoom: number;
  fitMode: FitMode;
  rotation: 0 | 90 | 180 | 270;
  scrollMode: ScrollMode;
  spreadMode: SpreadMode;
  cursorMode: CursorMode;
  isFullscreen: boolean;

  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setFitMode: (mode: FitMode) => void;
  setRotation: (rotation: 0 | 90 | 180 | 270) => void;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;
  setScrollMode: (mode: ScrollMode) => void;
  setSpreadMode: (mode: SpreadMode) => void;
  setCursorMode: (mode: CursorMode) => void;
  toggleFullscreen: () => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const ZOOM_STEP = 0.1;

export const createViewportSlice: StateCreator<
  ViewportSlice,
  [],
  [],
  ViewportSlice
> = (set, get) => ({
  zoom: 1.0,
  fitMode: 'page-fit',
  rotation: 0,
  scrollMode: 'vertical',
  spreadMode: 'none',
  cursorMode: 'select',
  isFullscreen: false,

  setZoom: (zoom: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(zoom, MAX_ZOOM));
    set({ zoom: clamped, fitMode: 'custom' });
  },

  zoomIn: () => {
    const { zoom } = get();
    const next = Math.min(zoom + ZOOM_STEP, MAX_ZOOM);
    set({ zoom: next, fitMode: 'custom' });
  },

  zoomOut: () => {
    const { zoom } = get();
    const next = Math.max(zoom - ZOOM_STEP, MIN_ZOOM);
    set({ zoom: next, fitMode: 'custom' });
  },

  setFitMode: (mode: FitMode) => set({ fitMode: mode }),

  setRotation: (rotation: 0 | 90 | 180 | 270) => set({ rotation }),

  rotateClockwise: () => {
    const { rotation } = get();
    const next = ((rotation / 90 + 1) % 4) * 90 as 0 | 90 | 180 | 270;
    set({ rotation: next });
  },

  rotateCounterClockwise: () => {
    const { rotation } = get();
    const next = ((rotation / 90 + 3) % 4) * 90 as 0 | 90 | 180 | 270;
    set({ rotation: next });
  },

  setScrollMode: (mode: ScrollMode) => set({ scrollMode: mode }),
  setSpreadMode: (mode: SpreadMode) => set({ spreadMode: mode }),
  setCursorMode: (mode: CursorMode) => set({ cursorMode: mode }),
  toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),
});
