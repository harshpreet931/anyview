import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { AdapterFeatures } from '../../core/types';
import { ToolbarPageNav } from './ToolbarPageNav';
import { ToolbarZoom } from './ToolbarZoom';
import { ToolbarActions } from './ToolbarActions';
import { ToolbarAnnotations } from './ToolbarAnnotations';
import { ToolbarSearch } from './ToolbarSearch';

interface ToolbarProps {
  features?: AdapterFeatures;
}

export function Toolbar({ features }: ToolbarProps) {
  const strings = useStrings();
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);
  const toggleSidebar = useViewerStore((s) => s.toggleSidebar);
  const searchOpen = useViewerStore((s) => s.searchOpen);
  const setSearchOpen = useViewerStore((s) => s.setSearchOpen);

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

        <ToolbarPageNav />

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

        <ToolbarZoom {...(features ? { features } : {})} />

        <ToolbarActions {...(features ? { features } : {})} />

        {features?.annotations && <ToolbarAnnotations />}
      </div>

      {searchOpen && features?.search && <ToolbarSearch />}
    </>
  );
}
