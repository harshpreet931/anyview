import { useEffect, useRef } from 'react';
import { useStrings } from '../../i18n/I18nProvider';
import { formatString } from '../../i18n/strings';
import type { Adapter, FormatId, PageRef } from '../../core/types';

export const LIVE_PREVIEW_MAX_BYTES = 1_000_000;

const THUMB_WIDTH = 150;

export function ThumbnailList({
  pages,
  format,
  adapter,
  live,
  currentPage,
  onThumbnailClick,
}: {
  pages: readonly PageRef[];
  format: FormatId;
  adapter: Adapter | null;
  live: boolean;
  currentPage: number;
  onThumbnailClick: (index: number) => void;
}) {
  return (
    <ul className="dv-thumbnail-list">
      {pages.map((page, index) => (
        <li key={page.index}>
          <Thumbnail
            page={page}
            index={index}
            format={format}
            adapter={live ? adapter : null}
            current={currentPage === index}
            onClick={() => onThumbnailClick(index)}
          />
        </li>
      ))}
    </ul>
  );
}

function Thumbnail({
  page,
  index,
  format,
  adapter,
  current,
  onClick,
}: {
  page: PageRef;
  index: number;
  format: FormatId;
  adapter: Adapter | null;
  current: boolean;
  onClick: () => void;
}) {
  const strings = useStrings();
  const canvasFormat = format === 'pdf' || format === 'image';
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adapter?.renderPage) return;
    const button = buttonRef.current;
    const target = canvasFormat ? canvasRef.current : docRef.current;
    if (!button || !target) return;

    const controller = new AbortController();

    const render = () => {
      if (!canvasFormat) {
        const boxWidth = target.parentElement?.clientWidth || THUMB_WIDTH;
        target.style.width = `${page.width}px`;
        target.style.height = `${page.height}px`;
        target.style.transform = `scale(${boxWidth / page.width})`;
      }
      adapter
        .renderPage({
          page,
          target,
          scale: canvasFormat ? THUMB_WIDTH / page.width : 1,
          rotation: 0,
          devicePixelRatio: window.devicePixelRatio,
          signal: controller.signal,
        })
        .then(() => {
          if (!canvasFormat) return;
          target.style.width = '';
          target.style.height = '';
        })
        .catch(() => {});
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          render();
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(button);

    return () => {
      io.disconnect();
      controller.abort();
    };
  }, [adapter, page, canvasFormat]);

  return (
    <button
      ref={buttonRef}
      className="dv-thumbnail"
      data-current={current}
      onClick={onClick}
      aria-label={formatString(strings.navigation.pageLabel, index + 1)}
      aria-current={current ? 'page' : undefined}
    >
      <div
        className="dv-thumbnail-image"
        style={{ ['--dv-thumb-ratio' as string]: `${page.width / page.height}` }}
      >
        {canvasFormat ? (
          <canvas ref={canvasRef} className="dv-thumbnail-canvas" />
        ) : (
          <div ref={docRef} className="dv-thumbnail-doc" aria-hidden="true" />
        )}
      </div>
      <div className="dv-thumbnail-label">{page.label || index + 1}</div>
    </button>
  );
}
