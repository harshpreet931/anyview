import type { AdapterManifest } from '../../core/types';

export const pptxManifest: AdapterManifest = {
  id: 'pptx',
  label: 'Presentation',
  extensions: ['pptx'],
  mimeTypes: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h10v14H3V1zm1 1v9h8V2H4zm0 10v2h8v-2H4z"/><path d="M5 4h6v1H5zm0 2h6v1H5zm0 2h4v1H5z" opacity="0.5"/></svg>`,
  features: {
    search: true,
    annotations: false,
    textSelection: true,
    print: false,
    thumbnails: true,
    outline: true,
    zoom: true,
    rotation: true,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 100,
  protocolVersion: 1,
};
