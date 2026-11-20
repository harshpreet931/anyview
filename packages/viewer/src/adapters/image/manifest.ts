import type { AdapterManifest } from '../../core/types';

export const imageManifest: AdapterManifest = {
  id: 'image',
  label: 'Image',
  extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'],
  mimeTypes: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    'image/avif',
  ],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 3.5h11v9h-11v-9zm-.5-1a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-.5-.5h-12zM5 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-1.5 4l2.5-3 2 2.5L11 7l2.5 4h-10z"/></svg>`,
  features: {
    search: false,
    annotations: false,
    textSelection: false,
    print: true,
    thumbnails: false,
    outline: false,
    zoom: true,
    rotation: true,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 100,
  protocolVersion: 1,
};
