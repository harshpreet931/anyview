/* ============================================================
 * English Locale
 * ============================================================ */

import type { ViewerStrings } from './types';

export const en: ViewerStrings = {
  toolbar: {
    sidebarToggle: 'Toggle sidebar',
    searchToggle: 'Toggle search',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomReset: 'Reset zoom',
    rotateClockwise: 'Rotate clockwise',
    rotateCounterClockwise: 'Rotate counterclockwise',
    print: 'Print',
    download: 'Download',
    overflowMenu: 'More options',
  },
  navigation: {
    previousPage: 'Previous page',
    nextPage: 'Next page',
    firstPage: 'First page',
    lastPage: 'Last page',
    pageInput: 'Page number',
    pageOf: 'of',
  },
  search: {
    placeholder: 'Search...',
    caseSensitive: 'Match case',
    wholeWord: 'Whole word',
    regex: 'Regular expression',
    matchCase: 'Match case',
    nextMatch: 'Next match',
    prevMatch: 'Previous match',
    close: 'Close search',
    resultsCount: '{0} of {1}',
    noResults: 'Not found',
  },
  sidebar: {
    thumbnails: 'Thumbnails',
    outline: 'Outline',
    attachments: 'Attachments',
    layers: 'Layers',
  },
  states: {
    empty: 'No document open',
    emptyDescription: 'Drag and drop a file here, or click to browse',
    loading: 'Loading document...',
    error: 'Failed to load document',
    unsupported: 'Unsupported format',
    unsupportedDescription: 'This file format is not supported',
  },
  dialog: {
    close: 'Close',
    passwordPrompt: 'This document is password protected',
    passwordInput: 'Enter password',
    passwordSubmit: 'Unlock',
    properties: 'Document properties',
    title: 'Title',
    author: 'Author',
    subject: 'Subject',
    creator: 'Creator',
    producer: 'Producer',
    creationDate: 'Created',
    modificationDate: 'Modified',
    pages: 'Pages',
    fileSize: 'File size',
  },
};
