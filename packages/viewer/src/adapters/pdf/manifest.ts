import type { AdapterManifest } from '../../core/types';

export const pdfManifest: AdapterManifest = {
  id: 'pdf',
  label: 'PDF Document',
  extensions: ['pdf'],
  mimeTypes: ['application/pdf'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h7l4 4v10H3V1zm7 0v4h4l-4-4zM5 7v1h6V7H5zm0 3v1h6v-1H5zm0 3v1h6v-1H5z"/></svg>`,
  features: {
    search: true,
    annotations: true,
    textSelection: true,
    print: true,
    thumbnails: true,
    outline: true,
    zoom: true,
    rotation: true,
    attachments: true,
    fullscreen: true,
    download: true,
  },
  priority: 100,
  protocolVersion: 1,
};
