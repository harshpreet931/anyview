import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PdfAdapter } from 'anyview/pdf';
import { App } from './App';

// This app serves pdf.js's cmaps/standard-fonts/wasm/iccs from its own
// build output (see the copy-pdfjs-assets plugin in vite.config.ts), at a
// path relative to the app's deployed base (respects PAGES_BASE for the
// GitHub Pages build) rather than the library's own default.
PdfAdapter.configureAssets(`${import.meta.env.BASE_URL}pdfjs/`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
