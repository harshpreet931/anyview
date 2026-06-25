import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';

describe('viewport slice — zoom & fit', () => {
  it('setZoom clamps to [0.1, 5] and switches fitMode to custom', () => {
    const s = createViewerStore();
    s.getState().setFitMode('page-fit');

    s.getState().setZoom(2);
    expect(s.getState().zoom).toBe(2);
    expect(s.getState().fitMode).toBe('custom');

    s.getState().setZoom(99);
    expect(s.getState().zoom).toBe(5);
    s.getState().setZoom(0.001);
    expect(s.getState().zoom).toBe(0.1);
  });

  it('_applyFitZoom sets zoom WITHOUT touching fitMode', () => {
    const s = createViewerStore();
    s.getState().setFitMode('page-width');
    s.getState()._applyFitZoom(1.5);
    expect(s.getState().zoom).toBe(1.5);
    expect(s.getState().fitMode).toBe('page-width');
  });

  it('_applyFitZoom clamps to the zoom bounds', () => {
    const s = createViewerStore();
    s.getState()._applyFitZoom(42);
    expect(s.getState().zoom).toBe(5);
    s.getState()._applyFitZoom(-1);
    expect(s.getState().zoom).toBe(0.1);
  });

  it('zoomIn / zoomOut step and clamp', () => {
    const s = createViewerStore();
    s.getState().setZoom(4.95);
    s.getState().zoomIn();
    expect(s.getState().zoom).toBe(5); // clamped at max
    s.getState().setZoom(0.12);
    s.getState().zoomOut();
    expect(s.getState().zoom).toBe(0.1); // clamped at min
  });
});
