export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

export const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(zoom, MAX_ZOOM));

export const SIDEBAR_MIN_WIDTH = 140;
export const SIDEBAR_MAX_WIDTH = 400;
