import type { AdapterManifest } from '../../core/types';

export const textManifest: AdapterManifest = {
  id: 'text',
  label: 'Plain Text',
  extensions: ['txt', 'log'],
  mimeTypes: ['text/plain'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3h12v2H2V3zm0 3h12v1H2V6zm0 3h8v1H2V9zm0 3h12v1H2v-1z"/></svg>`,
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
  priority: 50,
  protocolVersion: 1,
};
