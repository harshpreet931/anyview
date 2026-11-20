import { useState } from 'react';
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '../../core/zoom';
import { useViewerStore } from '../../hooks/useDocViewer';

const STEP = 16;

export function useSidebarResize() {
  const sidebarWidth = useViewerStore((s) => s.sidebarWidth);
  const setSidebarWidth = useViewerStore((s) => s.setSidebarWidth);
  const [resizing, setResizing] = useState(false);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    setResizing(true);
    const onMove = (ev: PointerEvent) => setSidebarWidth(startWidth + (ev.clientX - startX));
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onResizeKey = (e: React.KeyboardEvent) => {
    const widthForKey: Record<string, number> = {
      ArrowLeft: sidebarWidth - STEP,
      ArrowRight: sidebarWidth + STEP,
      Home: SIDEBAR_MIN_WIDTH,
      End: SIDEBAR_MAX_WIDTH,
    };
    const width = widthForKey[e.key];
    if (width === undefined) return;
    e.preventDefault();
    setSidebarWidth(width);
  };

  return { sidebarWidth, resizing, startResize, onResizeKey };
}
