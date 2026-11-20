import type { AdapterManifest } from '../../core/types';

export const ipynbManifest: AdapterManifest = {
  id: 'ipynb',
  label: 'Jupyter Notebook',
  extensions: ['ipynb'],
  mimeTypes: ['application/x-ipynb+json'],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h10v14H3V1zm1 1v12h8V2H4zm1 2h6v1H5V4zm0 3h6v1H5V7zm0 3h4v1H5v-1z"/></svg>`,
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
