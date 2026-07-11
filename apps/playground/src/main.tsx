import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PdfAdapter } from 'anyview/pdf';
import { App } from './App';

PdfAdapter.configureAssets(`${import.meta.env.BASE_URL}pdfjs/`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
