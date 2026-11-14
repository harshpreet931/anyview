import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PdfAdapter } from 'anyview/pdf';
import { ExamplesPage } from './ExamplesPage';
import '../../../../packages/viewer/src/styles/viewer.css';
import '../playground.css';
import './examples.css';

PdfAdapter.configureAssets(`${import.meta.env.BASE_URL}pdfjs/`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExamplesPage />
  </StrictMode>,
);
