import { useState, useCallback, useRef, useEffect } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import { formatString } from '../../i18n/strings';
import { Icon } from '../common/Icon';

export function ToolbarSearch() {
  const strings = useStrings();
  const search = useViewerStore((s) => s.search);
  const clearSearch = useViewerStore((s) => s.clearSearch);
  const nextMatch = useViewerStore((s) => s.nextMatch);
  const prevMatch = useViewerStore((s) => s.prevMatch);
  const searchState = useViewerStore((s) => s.searchState);
  const searchResult = useViewerStore((s) => s.searchResult);
  const currentMatchIndex = useViewerStore((s) => s.currentMatchIndex);
  const setSearchOpen = useViewerStore((s) => s.setSearchOpen);

  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // This only mounts while the bar is open, so open/close is mount/unmount:
  // focus on the way in, drop the pending query and its results on the way out.
  useEffect(() => {
    searchInputRef.current?.focus();
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      clearSearch();
    };
  }, [clearSearch]);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (text.trim()) {
        searchTimer.current = setTimeout(() => {
          search({
            text,
            caseSensitive: false,
            wholeWord: false,
            regex: false,
            diacritics: false,
          });
        }, 180);
      } else {
        clearSearch();
      }
    },
    [search, clearSearch],
  );

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, [setSearchOpen]);

  const matchCount = searchResult?.matches.length ?? 0;

  return (
    <search className="dv-search-bar">
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
        <Icon name="chevron-left" />
      </button>
      <button
        className="dv-button"
        onClick={nextMatch}
        disabled={matchCount === 0}
        aria-label={strings.search.nextMatch}
        title={strings.search.nextMatch}
      >
        <Icon name="chevron-right" />
      </button>
      <button
        className="dv-button"
        onClick={handleCloseSearch}
        aria-label={strings.search.close}
        title={strings.search.close}
      >
        <Icon name="close" />
      </button>
    </search>
  );
}
