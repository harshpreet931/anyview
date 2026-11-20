import type { AdapterManifest } from '../../core/types';

export const csvManifest: AdapterManifest = {
  id: 'csv',
  label: 'CSV Data',
  extensions: ['csv', 'tsv'],
  mimeTypes: ['text/csv', 'text/tab-separated-values'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v12H2V2zm1 1v3h3V3H3zm4 0v3h3V3H7zm4 0v3h2V3h-2zM3 7v3h3V7H3zm4 0v3h3V7H7zm4 0v3h2V7h-2zM3 11v2h3v-2H3zm4 0v2h3v-2H7zm4 0v2h2v-2h-2z"/></svg>`,
  features: {
    search: true,
    annotations: false,
    textSelection: true,
    print: true,
    thumbnails: false,
    outline: false,
    zoom: true,
    rotation: false,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 90,
  protocolVersion: 1,
};
