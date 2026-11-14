import { useState, useCallback, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { DocViewer, type FileSource, type DocumentModel, type ViewerError } from 'anyview';
import { SAMPLE_FILES, createSampleFileSource } from './samples';
import { Mascot, LogoMark } from './components/Mascot';
import { SamplePicker } from './components/SamplePicker';
import { CopyCommand } from './components/CopyCommand';
import { useSiteTheme } from './components/useSiteTheme';
import { ArrowIcon, GitHubIcon, MoonIcon, SunIcon, UploadIcon } from './components/icons';
import '../../../packages/viewer/src/styles/viewer.css';
import './playground.css';

const REPO = 'https://github.com/harshpreet931/anyview';
const ACCEPT =
  '.pdf,.docx,.xlsx,.pptx,.csv,.tsv,.html,.htm,.md,.markdown,.txt,.log,.ipynb,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.avif,.ts,.tsx,.js,.jsx,.json,.yaml,.yml,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.css,.scss,.less,.vue,.svelte,.php,.sh,.bash,.zsh,.sql,.dockerfile';

type ReaderTheme = 'light' | 'dark' | 'auto' | 'sepia';

const NOTES = [
  {
    kicker: 'formats',
    body: 'PDF, Word, Excel, PowerPoint, CSV, Markdown, Jupyter, code, HTML, plain text and images, all through the same component. Each format’s engine loads only when a file needs it.',
  },
  {
    kicker: 'rendering',
    body: 'PDFs draw with pdf.js in a Web Worker and keep a real text layer, so you can select and search. Office files become clean, sanitized HTML, not screenshots in a frame.',
  },
  {
    kicker: 'privacy',
    body: 'There is no server and no upload step. The file is read in the page and never leaves the visitor’s browser.',
  },
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => (el.dataset.reveal = 'in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.reveal = 'in';
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Divider({ label }: { label: string }) {
  return (
    <h2 className="pg-divider">
      <span>{label}</span>
    </h2>
  );
}

export function App() {
  const [source, setSource] = useState<FileSource | undefined>(undefined);
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('auto');
  const [isDragging, setIsDragging] = useState(false);
  const [activeSample, setActiveSample] = useState<number | null>(null);
  const { theme: siteTheme, toggle: toggleSiteTheme } = useSiteTheme();
  useReveal();

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSource({ kind: 'file', file });
      setActiveSample(null);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSource({ kind: 'file', file });
      setActiveSample(null);
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const clear = () => setIsDragging(false);
    const onLeave = (e: globalThis.DragEvent) => {
      if (!e.relatedTarget) clear();
    };
    window.addEventListener('drop', clear, true);
    window.addEventListener('dragend', clear, true);
    window.addEventListener('dragleave', onLeave, true);
    return () => {
      window.removeEventListener('drop', clear, true);
      window.removeEventListener('dragend', clear, true);
      window.removeEventListener('dragleave', onLeave, true);
    };
  }, [isDragging]);

  const loadSample = useCallback((index: number) => {
    const sample = SAMPLE_FILES[index];
    if (sample) {
      setSource(createSampleFileSource(sample));
      setActiveSample(index);
    }
  }, []);

  // "Auto" follows the site's sky, not just the OS, so the two never disagree.
  const viewerTheme = readerTheme === 'auto' ? siteTheme : readerTheme;
  const nextThemeLabel = siteTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <div
      className="pg-root"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
    >
      <div className="pg-sky" aria-hidden="true">
        <span className="pg-cloud pg-cloud-1" />
        <span className="pg-cloud pg-cloud-2" />
        <span className="pg-cloud pg-cloud-3" />
        <span className="pg-cloud pg-cloud-4" />
        <span className="pg-stars" />
        <span className="pg-grain" />
      </div>

      <header className="pg-topbar">
        <a className="pg-round pg-home" href={import.meta.env.BASE_URL} aria-label="anyview home">
          <LogoMark />
        </a>

        <SamplePicker samples={SAMPLE_FILES} active={activeSample} onPick={loadSample} />

        <div className="pg-topbar-end">
          <label className="pg-upload-btn">
            <input type="file" onChange={handleFileChange} accept={ACCEPT} />
            <UploadIcon width={16} height={16} />
            <span>Open file</span>
          </label>
          <a className="pg-round pg-hide-sm" href={REPO} aria-label="anyview on GitHub">
            <GitHubIcon />
          </a>
          <button
            type="button"
            className="pg-round pg-theme-toggle"
            onClick={toggleSiteTheme}
            aria-label={nextThemeLabel}
            title={nextThemeLabel}
            data-theme-icon={siteTheme}
          >
            <SunIcon className="pg-icon-sun" />
            <MoonIcon className="pg-icon-moon" />
          </button>
        </div>
      </header>

      <main className="pg-stage">
        <section className="pg-hero" aria-labelledby="pg-title">
          <Mascot className="pg-hero-mascot" />
          <h1 id="pg-title" className="pg-display">
            <span>One component.</span>
            <span>Every format.</span>
            <span>
              Zero <em>iframes.</em>
            </span>
          </h1>
          <div className="pg-hero-copy">
            <p className="pg-lede">
              A document viewer for React that renders PDFs, Office files, notebooks, code and images
              natively in the page.
            </p>
            <div className="pg-cta-row">
              <a className="pg-btn-black" href={`${REPO}#readme`}>
                Get started
                <ArrowIcon width={16} height={16} />
              </a>
              <CopyCommand command="npm i anyview" />
              <a className="pg-text-link" href={`${import.meta.env.BASE_URL}examples/`}>
                See examples
              </a>
            </div>
          </div>
        </section>

        <section className="pg-demo" aria-label="Live demo">
          <div className="pg-demo-meta">
            <span className="pg-live">
              <span className="pg-live-dot" aria-hidden="true" />
              <span>
                Live demo<span className="pg-live-more">, files never leave your browser</span>
              </span>
            </span>
            <label className="pg-reader">
              <span>Reader</span>
              <select
                className="pg-theme-select"
                value={readerTheme}
                onChange={(e) => setReaderTheme(e.target.value as ReaderTheme)}
                aria-label="Viewer theme"
              >
                <option value="auto">Auto</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="sepia">Sepia</option>
              </select>
            </label>
          </div>
          <div className="pg-card pg-canvas">
            <DocViewer
              {...(source ? { source } : {})}
              theme={viewerTheme}
              showToolbar
              showSidebar
              onDocumentLoad={(model: DocumentModel) => console.log('Loaded:', model.format, model.pageCount, 'pages')}
              onError={(err: ViewerError) => console.error('Error:', err)}
            />
          </div>
        </section>
      </main>

      <section className="pg-column" aria-label="About anyview">
        <Divider label="What it does" />
        {NOTES.map((n, i) => (
          <article key={n.kicker} className="pg-card pg-note" data-reveal style={{ ['--i' as string]: i }}>
            <span className="pg-note-kicker">{n.kicker}</span>
            <p>{n.body}</p>
          </article>
        ))}

        <Divider label="Two lines" />
        <article className="pg-card pg-code" data-reveal tabIndex={0} aria-label="Usage example">
          <pre>
            <code>
              <span className="tk-k">import</span> {'{ '}DocViewer{' }'} <span className="tk-k">from</span>{' '}
              <span className="tk-s">'anyview'</span>;{'\n\n'}
              <span className="tk-p">{'<'}</span>
              <span className="tk-t">DocViewer</span> <span className="tk-a">source</span>={'{{ '}kind:{' '}
              <span className="tk-s">'url'</span>, url: <span className="tk-s">'/report.pdf'</span>
              {' }}'} <span className="tk-p">{'/>'}</span>
            </code>
          </pre>
        </article>

        <Divider label="In real apps" />
        <a className="pg-card pg-examples-link" data-reveal href={`${import.meta.env.BASE_URL}examples/`}>
          <span>
            <strong>See it inside four small apps</strong>
            <span>Chat attachments, an upload preview, contract review with comments, and custom controls. Live, with full source.</span>
          </span>
          <ArrowIcon width={18} height={18} />
        </a>

        <article className="pg-promo" data-reveal>
          <div className="pg-promo-head">
            <div>
              <h2>Free, and staying that way</h2>
              <p>MIT licensed. About 23 kB gzip at the base, with every format engine split out and loaded on demand.</p>
            </div>
            <span className="pg-wordmark">
              any<em>view</em>
            </span>
          </div>
          <div className="pg-promo-actions">
            <a className="pg-btn-ghost-dark" href={`${REPO}#readme`}>Read the docs</a>
            <a className="pg-btn-white" href={REPO}>
              <GitHubIcon width={16} height={16} />
              Star on GitHub
            </a>
          </div>
        </article>

        <footer className="pg-footer">
          <span>
            any<em>view</em>
          </span>
          <span>MIT · made for the web, rendered in the page</span>
        </footer>
      </section>

      {isDragging && (
        <div className="pg-drop-overlay">
          <div className="pg-drop-overlay-inner">
            <UploadIcon width={28} height={28} />
            <span>Drop to view it here</span>
          </div>
        </div>
      )}
    </div>
  );
}
