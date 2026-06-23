/* ============================================================
 * Toolbar — main toolbar with zoom, navigation, and actions
 * ============================================================ */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings, formatString } from '../../i18n/I18nProvider';
import type { AdapterFeatures, AnnotationType, SearchQuery } from '../../core/types';

interface ToolbarProps {
  features?: AdapterFeatures;
}

const ANNOTATION_TOOLS: ReadonlyArray<{
  tool: AnnotationType;
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

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

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
    setSearchText('');
    clearSearch();
  }, [clearSearch]);

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
              onClick={() => setSearchOpen((v) => !v)}
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
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                aria-label="Zoom level"
              >
                <option value={0.5}>50%</option>
                <option value={0.75}>75%</option>
                <option value={1.0}>100%</option>
                <option value={1.25}>125%</option>
                <option value={1.5}>150%</option>
                <option value={2.0}>200%</option>
                <option value={3.0}>300%</option>
                <option value={5.0}>500%</option>
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
        </div>

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

      {searchOpen && (
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
