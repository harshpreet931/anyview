import { describe, it, expect, beforeEach } from 'vitest';
import { createViewerStore } from './index';

const KEY = 'sidebar-persist-test';
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? '{}').state ?? {};

describe('sidebar preference persistence', () => {
  beforeEach(() => localStorage.clear());

  it('a responsive auto-close is not saved as the user preference', () => {
    const narrow = createViewerStore({ persistKey: KEY });
    narrow.getState().closeSidebarTransiently();
    expect(narrow.getState().sidebarOpen).toBe(false);
    expect(saved().sidebarOpen).not.toBe(false);

    const wide = createViewerStore({ persistKey: KEY });
    expect(wide.getState().sidebarOpen).toBe(true);
  });

  it('an explicit user toggle is still saved and restored', () => {
    const a = createViewerStore({ persistKey: KEY });
    a.getState().toggleSidebar();
    expect(saved().sidebarOpen).toBe(false);
    expect(createViewerStore({ persistKey: KEY }).getState().sidebarOpen).toBe(false);

    a.getState().setSidebarOpen(true);
    expect(saved().sidebarOpen).toBe(true);
  });

  it('a transient close keeps a previously saved "closed" preference', () => {
    localStorage.setItem(KEY, JSON.stringify({ state: { sidebarOpen: false }, version: 0 }));
    const s = createViewerStore({ persistKey: KEY });
    expect(s.getState().sidebarOpen).toBe(false);
    s.getState().closeSidebarTransiently();
    s.getState().setSidebarWidth(260);
    expect(saved().sidebarOpen).toBe(false);
  });

  it('reopening after a transient close is saved as open', () => {
    const s = createViewerStore({ persistKey: KEY });
    s.getState().closeSidebarTransiently();
    s.getState().toggleSidebar();
    expect(s.getState().sidebarOpen).toBe(true);
    expect(saved().sidebarOpen).toBe(true);
  });
});
