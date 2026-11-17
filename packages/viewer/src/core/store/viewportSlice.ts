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
  _applyFitZoom: (zoom: number) => void;
  setRotation: (rotation: 0 | 90 | 180 | 270) => void;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;
  setScrollMode: (mode: ScrollMode) => void;
  setSpreadMode: (mode: SpreadMode) => void;
  setCursorMode: (mode: CursorMode) => void;
  toggleFullscreen: () => void;

  _rootElement: HTMLElement | null;
  setRootElement: (el: HTMLElement | null) => void;
  _setFullscreen: (value: boolean) => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const ZOOM_LADDER = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

function nextZoom(zoom: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_LADDER.find((z) => z > zoom * 1.01) ?? MAX_ZOOM;
  return [...ZOOM_LADDER].reverse().find((z) => z < zoom / 1.01) ?? MIN_ZOOM;
}

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

  zoomIn: () => set({ zoom: nextZoom(get().zoom, 1), fitMode: 'custom' }),

  zoomOut: () => set({ zoom: nextZoom(get().zoom, -1), fitMode: 'custom' }),

  setFitMode: (mode: FitMode) => set({ fitMode: mode }),

  _applyFitZoom: (zoom: number) =>
    set({ zoom: Math.max(MIN_ZOOM, Math.min(zoom, MAX_ZOOM)) }),

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

  _rootElement: null,
  setRootElement: (el: HTMLElement | null) => set({ _rootElement: el }),
  _setFullscreen: (value: boolean) => set({ isFullscreen: value }),

  toggleFullscreen: () => {
    if (typeof document === 'undefined') return;
    // Don't flip isFullscreen here - the fullscreenchange listener drives it so Esc stays in sync.
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      return;
    }
    const el = get()._rootElement;
    el?.requestFullscreen?.().catch(() => {});
  },
});
