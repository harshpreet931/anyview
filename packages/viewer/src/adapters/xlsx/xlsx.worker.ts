import * as XLSX from 'xlsx';
import { readSheets, sheetBuffers } from './read-sheets';

// Static imports keep the worker one bundle, which classic (iife) workers such as Vite 7's default require.
self.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
  try {
    const sheets = readSheets(XLSX, data);
    postMessage({ sheets }, { transfer: sheetBuffers(sheets) });
  } catch (error) {
    postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
