import { useState, type ComponentType } from 'react';
import { LogoMark } from '../components/Mascot';
import { GitHubIcon, MoonIcon, SunIcon } from '../components/icons';
import { useSiteTheme } from '../components/useSiteTheme';
import { ChatAttachments } from './demos/ChatAttachments';
import { UploadPreview } from './demos/UploadPreview';
import { ContractReview } from './demos/ContractReview';
import { CustomControls } from './demos/CustomControls';
import chatSource from './demos/ChatAttachments.tsx?raw';
import uploadSource from './demos/UploadPreview.tsx?raw';
import reviewSource from './demos/ContractReview.tsx?raw';
import controlsSource from './demos/CustomControls.tsx?raw';

const REPO = 'https://github.com/harshpreet931/anyview';

type Example = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  uses: string[];
  Demo: ComponentType<{ theme: 'light' | 'dark' }>;
  source: string;
};

const EXAMPLES: Example[] = [
  {
    id: 'chat-attachments',
    kicker: 'Messaging, inboxes, support tools',
    title: 'Open attachments without leaving the conversation',
    body: 'Click a file in the thread and it opens in a modal, whatever the format. No download, no new tab, no viewer per file type.',
    uses: ['source={{ kind: "file" }}', '<dialog>', 'showSidebar={false}'],
    Demo: ChatAttachments,
    source: chatSource,
  },
  {
    id: 'upload-preview',
    kicker: 'Forms, onboarding, expense tools',
    title: 'Preview a file before it is uploaded',
    body: 'People see exactly what they picked, and the form learns the format and page count from onDocumentLoad. Nothing leaves the browser until they submit.',
    uses: ['onDocumentLoad', 'onError', 'DocumentModel'],
    Demo: UploadPreview,
    source: uploadSource,
  },
  {
    id: 'contract-review',
    kicker: 'Legal, approvals, design review',
    title: 'Mark up a document and keep the comments',
    body: 'Highlights and notes stream out through onAnnotationChange. List them beside the document, jump to their page, and save them as JSON next to the file.',
    uses: ['onAnnotationChange', 'ref.goToPage', 'ref.exportAnnotations'],
    Demo: ContractReview,
    source: reviewSource,
  },
  {
    id: 'custom-controls',
    kicker: 'Decks, readers, embedded docs',
    title: 'Bring your own controls',
    body: 'Hide the built-in toolbar and render your own UI inside the viewer. The hooks read the viewer they sit in, so a page counter is four lines.',
    uses: ['showToolbar={false}', 'children', 'useNavigation', 'useZoom'],
    Demo: CustomControls,
    source: controlsSource,
  },
];

function ExampleCard({ example, theme, index }: { example: Example; theme: 'light' | 'dark'; index: number }) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const { Demo } = example;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(example.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="ex-section" id={example.id} aria-labelledby={`${example.id}-title`}>
      <div className="ex-intro">
        <span className="ex-number">{String(index + 1).padStart(2, '0')}</span>
        <span className="ex-kicker">{example.kicker}</span>
        <h2 id={`${example.id}-title`}>{example.title}</h2>
        <p>{example.body}</p>
        <ul className="ex-uses" aria-label="APIs used">
          {example.uses.map((u) => (
            <li key={u}>
              <code>{u}</code>
            </li>
          ))}
        </ul>
      </div>

      <div className="pg-card ex-stage">
        <div className="ex-tabs" role="tablist" aria-label={`${example.title} views`}>
          <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>
            Preview
          </button>
          <button type="button" role="tab" aria-selected={tab === 'code'} onClick={() => setTab('code')}>
            Code
          </button>
          {tab === 'code' && (
            <button type="button" className="ex-copy" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
        <div className="ex-panel" role="tabpanel">
          <div className="ex-demo" hidden={tab !== 'preview'}>
            <Demo theme={theme} />
          </div>
          {tab === 'code' && (
            <pre className="ex-code" tabIndex={0}>
              <code>{example.source}</code>
            </pre>
          )}
        </div>
      </div>
    </section>
  );
}

export function ExamplesPage() {
  const { theme, toggle } = useSiteTheme();
  const nextThemeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  const home = import.meta.env.BASE_URL;

  return (
    <div className="pg-root">
      <div className="pg-sky" aria-hidden="true">
        <span className="pg-cloud pg-cloud-1" />
        <span className="pg-cloud pg-cloud-2" />
        <span className="pg-cloud pg-cloud-3" />
        <span className="pg-stars" />
        <span className="pg-grain" />
      </div>

      <header className="pg-topbar ex-topbar">
        <a className="pg-round pg-home" href={home} aria-label="anyview home">
          <LogoMark />
        </a>
        <nav className="ex-nav" aria-label="Examples">
          {EXAMPLES.map((e, i) => (
            <a key={e.id} href={`#${e.id}`}>
              {String(i + 1).padStart(2, '0')}
            </a>
          ))}
        </nav>
        <div className="pg-topbar-end">
          <a className="pg-upload-btn" href={home}>
            Live demo
          </a>
          <a className="pg-round pg-hide-sm" href={REPO} aria-label="anyview on GitHub">
            <GitHubIcon />
          </a>
          <button
            type="button"
            className="pg-round pg-theme-toggle"
            onClick={toggle}
            aria-label={nextThemeLabel}
            title={nextThemeLabel}
            data-theme-icon={theme}
          >
            <SunIcon className="pg-icon-sun" />
            <MoonIcon className="pg-icon-moon" />
          </button>
        </div>
      </header>

      <main className="ex-main">
        <header className="ex-hero">
          <h1 className="pg-display ex-title">
            <span>
              Built into <em>real</em> apps.
            </span>
          </h1>
          <p>
            Four small apps that use anyview the way you would: attachments in a chat, a preview in an upload
            form, a review screen with comments, and a reader with its own controls. Each one is running live,
            and the Code tab is its full source.
          </p>
        </header>

        {EXAMPLES.map((e, i) => (
          <ExampleCard key={e.id} example={e} theme={theme} index={i} />
        ))}

        <footer className="pg-footer">
          <span>
            any<em>view</em>
          </span>
          <span>
            <a href={home}>Live demo</a> · <a href={`${REPO}#readme`}>Docs</a> · MIT
          </span>
        </footer>
      </main>
    </div>
  );
}
