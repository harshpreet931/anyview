import type { AdapterManifest } from '../../core/types';

export const htmlManifest: AdapterManifest = {
  id: 'html',
  label: 'HTML Document',
  extensions: ['html', 'htm'],
  mimeTypes: ['text/html'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l-3 6 3 6h8l3-6-3-6H4zm1 2h6l2 4-2 4H5L3 8l2-4z"/></svg>`,
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
  priority: 90,
  protocolVersion: 1,
};
