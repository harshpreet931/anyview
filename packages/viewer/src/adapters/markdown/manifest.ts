import type { AdapterManifest } from '../../core/types';

export const markdownManifest: AdapterManifest = {
  id: 'markdown',
  label: 'Markdown',
  extensions: ['md', 'markdown', 'mdx'],
  mimeTypes: ['text/markdown', 'text/x-markdown'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5h14v9H1v-9zm1 1v7h12v-7H2zm2 5V6h1l1.5 2L8 6h1v3.5H8V7.5L6.5 9.5 5 7.5v2H4zm7 0V6h1v3.5h-1zm0-1.5V6h2v1h-2z"/></svg>`,
  features: {
    search: true,
    annotations: false,
    textSelection: true,
    print: true,
    thumbnails: false,
    outline: true,
    zoom: true,
    rotation: false,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 100,
  protocolVersion: 1,
};
