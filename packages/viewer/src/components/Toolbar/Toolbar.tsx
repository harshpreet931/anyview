/* ============================================================
 * Toolbar - main toolbar with zoom, navigation, and actions
 * ============================================================ */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings, formatString } from '../../i18n/I18nProvider';
import type { AdapterFeatures, AnnotationTool, SearchQuery, SpreadMode } from '../../core/types';

interface ToolbarProps {
  features?: AdapterFeatures;
}

const ANNOTATION_TOOLS: ReadonlyArray<{
  tool: AnnotationTool;
  label: string;
  path: string;
}> = [
  {
    tool: 'highlight',
    label: 'Highlight',
    path: 'M3 11l6-6 4 4-6 6H3v-4zm0 6h14v-1H3v1z',
  },
  {
    tool: 'ink',
    label: 'Draw',
    path: 'M2 14l1-3 7-7 2 2-7 7-3 1zm9-10l1.5-1.5 2 2L13 6l-2-2z',
  },
  {
    tool: 'rectangle',
    label: 'Rectangle',
    path: 'M2 3h12v10H2V3zm1.5 1.5v7h9v-7h-9z',
  },
  {
    tool: 'ellipse',
    label: 'Ellipse',
    path: 'M8 3c3.6 0 6.5 2.2 6.5 5S11.6 13 8 13 1.5 10.8 1.5 8 4.4 3 8 3zm0 1.5C5.2 4.5 3 6.1 3 8s2.2 3.5 5 3.5 5-1.6 5-3.5-2.2-3.5-5-3.5z',
  },
  {
    tool: 'line',
    label: 'Line',
    path: 'M2.8 12.6l-1-1L12.2 1.2l1 1L2.8 12.6z',
  },
  {
    tool: 'arrow',
    label: 'Arrow',
    path: 'M2.8 12.6l-1-1L10 3.4H6V2h6.5v6.5H11v-4l-8.2 8.1z',
  },
  {
    tool: 'free-text',
    label: 'Text',
    path: 'M2 2h12v3h-1.5V3.5H8.75v9H10V14H6v-1.5h1.25v-9H3.5V5H2V2z',
  },
  {
    tool: 'sticky-note',
    label: 'Note',
    path: 'M3 2h10v8l-3 4H3V2zm7 11v-3h3l-3 3z',
  },
];

export function Toolbar({ features }: ToolbarProps) {
  const strings = useStrings();
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);
  const toggleSidebar = useViewerStore((s) => s.toggleSidebar);
  const zoom = useViewerStore((s) => s.zoom);
  const zoomIn = useViewerStore((s) => s.zoomIn);
  const zoomOut = useViewerStore((s) => s.zoomOut);
  const setZoom = useViewerStore((s) => s.setZoom);
  const fitMode = useViewerStore((s) => s.fitMode);
  const setFitMode = useViewerStore((s) => s.setFitMode);
  const spreadMode = useViewerStore((s) => s.spreadMode);
  const setSpreadMode = useViewerStore((s) => s.setSpreadMode);
  const cursorMode = useViewerStore((s) => s.cursorMode);
  const setCursorMode = useViewerStore((s) => s.setCursorMode);
  const rotateClockwise = useViewerStore((s) => s.rotateClockwise);
  const rotateCounterClockwise = useViewerStore((s) => s.rotateCounterClockwise);
  const currentPage = useViewerStore((s) => s.currentPage);
  const pageCount = useViewerStore((s) => s.document?.pageCount ?? 0);
  const goToPage = useViewerStore((s) => s.goToPage);
  const nextPage = useViewerStore((s) => s.nextPage);
  const prevPage = useViewerStore((s) => s.prevPage);
  const search = useViewerStore((s) => s.search);
  const clearSearch = useViewerStore((s) => s.clearSearch);
  const nextMatch = useViewerStore((s) => s.nextMatch);
  const prevMatch = useViewerStore((s) => s.prevMatch);
  const searchState = useViewerStore((s) => s.searchState);
  const searchResult = useViewerStore((s) => s.searchResult);
  const currentMatchIndex = useViewerStore((s) => s.currentMatchIndex);
  const activeTool = useViewerStore((s) => s.activeAnnotationTool);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);
  const downloadDocument = useViewerStore((s) => s.downloadDocument);
  const printDocument = useViewerStore((s) => s.printDocument);
  const toggleFullscreen = useViewerStore((s) => s.toggleFullscreen);
  const isFullscreen = useViewerStore((s) => s.isFullscreen);
  const setPropertiesOpen = useViewerStore((s) => s.setPropertiesOpen);
  const hasDocument = useViewerStore((s) => s.document !== null);
  // Search open/close lives in the store so the Ctrl/Cmd+F shortcut and the
  // toolbar toggle drive the same panel.
  const searchOpen = useViewerStore((s) => s.searchOpen);
  const setSearchOpen = useViewerStore((s) => s.setSearchOpen);

  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    } else {
      // Closing (toolbar button, Escape, or shortcut) clears the query so a
      // reopen starts fresh and stale highlights are dropped.
      setSearchText('');
      clearSearch();
    }
  }, [searchOpen, clearSearch]);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      if (text.trim()) {
        const query: SearchQuery = {
          text,
          caseSensitive: false,
          wholeWord: false,
          regex: false,
          diacritics: false,
        };
        search(query);
      } else {
        clearSearch();
      }
    },
    [search, clearSearch],
  );

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, [setSearchOpen]);

  // Value shown in the zoom control. Fit modes win; otherwise a matching preset,
  // else a live "NN%" entry so custom zoom (wheel, Ctrl±) reads correctly.
  const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5];
  const zoomPct = Math.round(zoom * 100);
  const matchedPreset = ZOOM_PRESETS.find((p) => Math.abs(p - zoom) < 0.005);
  const zoomValue =
    fitMode === 'page-fit'
      ? 'fit-page'
      : fitMode === 'page-width'
        ? 'fit-width'
        : fitMode === 'actual-size'
          ? 'actual'
          : matchedPreset !== undefined
            ? String(matchedPreset)
            : 'live';

  const handleZoomSelect = useCallback(
    (value: string) => {
      if (value === 'fit-page') setFitMode('page-fit');
      else if (value === 'fit-width') setFitMode('page-width');
      else if (value === 'actual') setFitMode('actual-size');
      else if (value === 'live') {
        /* display-only */
      } else setZoom(parseFloat(value));
    },
    [setFitMode, setZoom],
  );

  const matchCount = searchResult?.matches.length ?? 0;

  return (
    <>
      <div className="dv-toolbar" role="toolbar" aria-label="Document viewer toolbar">
        <div className="dv-toolbar-group">
          <button
            className="dv-button"
            onClick={toggleSidebar}
            aria-expanded={sidebarOpen}
            aria-label={strings.toolbar.sidebarToggle}
            title={strings.toolbar.sidebarToggle}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h4v12H2V2zm5 0h7v12H7V2z" />
            </svg>
          </button>
        </div>

        <div className="dv-toolbar-group dv-toolbar-page-nav">
          <button
            className="dv-button"
            onClick={prevPage}
            disabled={currentPage <= 0}
            aria-label={strings.navigation.previousPage}
            title={strings.navigation.previousPage}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 4L6 8l4 4V4z" />
            </svg>
          </button>
          <input
            type="number"
            className="dv-page-input"
            value={currentPage + 1}
            min={1}
            max={pageCount || 1}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) goToPage(val - 1);
            }}
            aria-label={strings.navigation.pageInput}
          />
          <span className="dv-page-count">
            / {pageCount}
          </span>
          <button
            className="dv-button"
            onClick={nextPage}
            disabled={currentPage >= pageCount - 1}
            aria-label={strings.navigation.nextPage}
            title={strings.navigation.nextPage}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 4l4 4-4 4V4z" />
            </svg>
          </button>
        </div>

        <div className="dv-toolbar-spacer" />

        {features?.search && (
          <div className="dv-toolbar-group">
            <button
              className="dv-button"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-expanded={searchOpen}
              aria-label={strings.toolbar.searchToggle}
              title={strings.toolbar.searchToggle}
              data-toggled={searchOpen}
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 1a5 5 0 1 0 3.09 8.95l4.48 4.49 1.42-1.42-4.49-4.48A5 5 0 0 0 6 1zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
              </svg>
            </button>
          </div>
        )}

        <div className="dv-toolbar-group">
          {features?.zoom !== false && (
            <>
              <button
                className="dv-button"
                onClick={zoomOut}
                aria-label={strings.toolbar.zoomOut}
                title={strings.toolbar.zoomOut}
              >
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 7h8v2H4V7z" />
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 8 3z" />
                </svg>
              </button>
              <select
                className="dv-zoom-select"
                value={zoomValue}
                onChange={(e) => handleZoomSelect(e.target.value)}
                aria-label="Zoom level"
              >
                {zoomValue === 'live' && <option value="live">{zoomPct}%</option>}
                <optgroup label="Fit">
                  <option value="fit-page">Fit page</option>
                  <option value="fit-width">Fit width</option>
                  <option value="actual">Actual size</option>
                </optgroup>
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="1">100%</option>
                <option value="1.25">125%</option>
                <option value="1.5">150%</option>
                <option value="2">200%</option>
                <option value="3">300%</option>
                <option value="5">500%</option>
              </select>
              <button
                className="dv-button"
                onClick={zoomIn}
                aria-label={strings.toolbar.zoomIn}
                title={strings.toolbar.zoomIn}
              >
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M7 4h2v3h3v2H9v3H7V9H4V7h3V4z" />
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 8 3z" />
                </svg>
              </button>
              <button
                className="dv-button"
                onClick={() =>
                  setCursorMode(cursorMode === 'marquee' ? 'select' : 'marquee')
                }
                aria-pressed={cursorMode === 'marquee'}
                data-toggled={cursorMode === 'marquee'}
                aria-label="Marquee zoom"
                title="Marquee zoom - drag a box to zoom in"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="2.5" y="2.5" width="11" height="11" rx="1" strokeDasharray="2.5 1.8" />
                  <path d="M6 8h4M8 6v4" strokeLinecap="round" />
                </svg>
              </button>
            </>
          )}

          {features?.rotation && (
            <>
              <button
                className="dv-button"
                onClick={rotateCounterClockwise}
                aria-label={strings.toolbar.rotateCounterClockwise}
                title={strings.toolbar.rotateCounterClockwise}
              >
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 3a5 5 0 1 1-5 5H1a7 7 0 1 0 7-7V0L4 2l4 2V3z" />
                </svg>
              </button>
              <button
                className="dv-button"
                onClick={rotateClockwise}
                aria-label={strings.toolbar.rotateClockwise}
                title={strings.toolbar.rotateClockwise}
              >
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 3a5 5 0 1 0 5 5h2A7 7 0 1 1 8 1V0l4 2-4 2V3z" />
                </svg>
              </button>
            </>
          )}

          {pageCount > 1 && (
            <select
              className="dv-zoom-select"
              value={spreadMode}
              onChange={(e) => setSpreadMode(e.target.value as SpreadMode)}
              aria-label="Page layout"
              title="Page layout"
            >
              <option value="none">Single page</option>
              <option value="even">Two pages</option>
              <option value="odd">Two pages (cover)</option>
            </select>
          )}
        </div>

        {(features?.download || features?.print || features?.fullscreen || hasDocument) && (
          <div className="dv-toolbar-group dv-toolbar-actions">
            {features?.download && (
              <button
                className="dv-button"
                onClick={() => downloadDocument()}
                aria-label={strings.toolbar.download}
                title={strings.toolbar.download}
              >
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M7 1h2v6h3l-4 4-4-4h3V1zM3 13h10v2H3v-2z" />
                </svg>
              </button>
            )}
            {features?.print && (
              <button
                className="dv-button"
                onClick={() => printDocument()}
                aria-label={strings.toolbar.print}
                title={strings.toolbar.print}
              >
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 1h8v3H4V1zM3 5h10a2 2 0 0 1 2 2v4h-3v4H4v-4H1V7a2 2 0 0 1 2-2zm3 6v3h4v-3H6zm6-2.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" />
                </svg>
              </button>
            )}
            {features?.fullscreen && (
              <button
                className="dv-button"
                onClick={() => toggleFullscreen()}
                aria-pressed={isFullscreen}
                data-toggled={isFullscreen}
                aria-label={strings.toolbar.fullscreen}
                title={strings.toolbar.fullscreen}
              >
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 1h5v2H3v3H1V1zm9 0h5v5h-2V3h-3V1zM1 10h2v3h3v2H1v-5zm12 0h2v5h-5v-2h3v-3z" />
                </svg>
              </button>
            )}
            {hasDocument && (
              <button
                className="dv-button"
                onClick={() => setPropertiesOpen(true)}
                aria-label={strings.toolbar.properties}
                title={strings.toolbar.properties}
              >
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2.5A1.1 1.1 0 1 1 8 5.7a1.1 1.1 0 0 1 0-2.2zM6.5 7h2.2v4.5H10V13H6v-1.5h1.2V8.5H6.5V7z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {features?.annotations && (
          <div
            className="dv-toolbar-group dv-toolbar-annotations"
            role="radiogroup"
            aria-label="Annotation tools"
          >
            {ANNOTATION_TOOLS.map(({ tool, label, path }) => {
              const isActive = activeTool === tool;
              return (
                <button
                  key={tool}
                  className="dv-button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={label}
                  title={label}
                  data-toggled={isActive}
                  onClick={() => setActiveTool(isActive ? null : tool)}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d={path} />
                  </svg>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {searchOpen && features?.search && (
        <div className="dv-search-bar" role="search">
          <input
            ref={searchInputRef}
            type="text"
            className="dv-search-input"
            placeholder={strings.search.placeholder}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            aria-label={strings.search.placeholder}
          />
          <span className="dv-search-count" aria-live="polite">
            {searchState === 'searching'
              ? '…'
              : matchCount > 0
                ? formatString(
                    strings.search.resultsCount,
                    currentMatchIndex + 1,
                    matchCount,
                  )
                : searchText
                  ? strings.search.noResults
                  : ''}
          </span>
          <button
            className="dv-button"
            onClick={prevMatch}
            disabled={matchCount === 0}
            aria-label={strings.search.prevMatch}
            title={strings.search.prevMatch}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 4L6 8l4 4V4z" />
            </svg>
          </button>
          <button
            className="dv-button"
            onClick={nextMatch}
            disabled={matchCount === 0}
            aria-label={strings.search.nextMatch}
            title={strings.search.nextMatch}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 4l4 4-4 4V4z" />
            </svg>
          </button>
          <button
            className="dv-button"
            onClick={handleCloseSearch}
            aria-label={strings.search.close}
            title={strings.search.close}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
