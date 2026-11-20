import { useState, useRef, useEffect, type KeyboardEvent, type RefObject } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useLocale, useStrings } from '../../i18n/I18nProvider';
import { formatString } from '../../i18n/strings';
import { formatNumber } from '../../i18n/format';
import { IconButton } from './IconButton';

const SEARCH_DEBOUNCE_MS = 180;

type Timer = ReturnType<typeof setTimeout> | undefined;

function cancelPending(timer: RefObject<Timer>): boolean {
  if (!timer.current) return false;
  clearTimeout(timer.current);
  timer.current = undefined;
  return true;
}

export function ToolbarSearch() {
  const strings = useStrings();
  const locale = useLocale();
  const search = useViewerStore((s) => s.search);
  const clearSearch = useViewerStore((s) => s.clearSearch);
  const nextMatch = useViewerStore((s) => s.nextMatch);
  const prevMatch = useViewerStore((s) => s.prevMatch);
  const searchState = useViewerStore((s) => s.searchState);
  const searchResult = useViewerStore((s) => s.searchResult);
  const currentMatchIndex = useViewerStore((s) => s.currentMatchIndex);
  const setSearchOpen = useViewerStore((s) => s.setSearchOpen);
  const rootElement = useViewerStore((s) => s._rootElement);
  const rootRef = useRef(rootElement);
  useEffect(() => {
    rootRef.current = rootElement;
  }, [rootElement]);

  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<Timer>(undefined);

  // This only mounts while the bar is open, so open/close is mount/unmount:
  // focus on the way in, drop the pending query and its results on the way out.
  useEffect(() => {
    const input = searchInputRef.current;
    input?.focus();
    return () => {
      cancelPending(searchTimer);
      clearSearch();
      const active = document.activeElement;
      if (!active || active === document.body || active === input || !active.isConnected) {
        rootRef.current
          ?.querySelector<HTMLElement>('.dv-viewer-container')
          ?.focus({ preventScroll: true });
      }
    };
  }, [clearSearch]);

  const runSearch = (text: string) =>
    search({
      text,
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      diacritics: false,
    });

  const handleSearch = (text: string) => {
    setSearchText(text);
    cancelPending(searchTimer);
    if (text.trim()) {
      searchTimer.current = setTimeout(() => {
        searchTimer.current = undefined;
        runSearch(text);
      }, SEARCH_DEBOUNCE_MS);
    } else {
      clearSearch();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (cancelPending(searchTimer)) {
      if (searchText.trim()) runSearch(searchText);
      return;
    }
    if (e.shiftKey) prevMatch();
    else nextMatch();
  };

  const matchCount = searchResult?.matches.length ?? 0;

  let matchStatus = '';
  if (searchState === 'searching') matchStatus = '…';
  else if (searchResult?.truncated) matchStatus = formatString(strings.search.resultsCountCapped, currentMatchIndex + 1, formatNumber(matchCount, locale));
  else if (matchCount > 0) matchStatus = formatString(strings.search.resultsCount, currentMatchIndex + 1, matchCount);
  else if (searchText) matchStatus = strings.search.noResults;

  return (
    <search className="dv-search-bar">
      <input
        ref={searchInputRef}
        type="text"
        className="dv-search-input"
        placeholder={strings.search.placeholder}
        value={searchText}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={strings.search.placeholder}
      />
      <span className="dv-search-count" aria-live="polite">
        {matchStatus}
      </span>
      <IconButton
        icon="chevron-left"
        label={strings.search.prevMatch}
        onClick={prevMatch}
        disabled={matchCount === 0}
      />
      <IconButton
        icon="chevron-right"
        label={strings.search.nextMatch}
        onClick={nextMatch}
        disabled={matchCount === 0}
      />
      <IconButton icon="close" label={strings.search.close} onClick={() => setSearchOpen(false)} />
    </search>
  );
}
