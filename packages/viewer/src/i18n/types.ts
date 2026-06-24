/* ============================================================
 * i18n Types
 * ============================================================ */

export interface ViewerStrings {
  toolbar: {
    sidebarToggle: string;
    searchToggle: string;
    zoomIn: string;
    zoomOut: string;
    zoomReset: string;
    rotateClockwise: string;
    rotateCounterClockwise: string;
    print: string;
    download: string;
    fullscreen: string;
    properties: string;
    overflowMenu: string;
  };
  navigation: {
    previousPage: string;
    nextPage: string;
    firstPage: string;
    lastPage: string;
    pageInput: string;
    pageOf: string;
  };
  search: {
    placeholder: string;
    caseSensitive: string;
    wholeWord: string;
    regex: string;
    matchCase: string;
    nextMatch: string;
    prevMatch: string;
    close: string;
    resultsCount: string;
    noResults: string;
  };
  sidebar: {
    thumbnails: string;
    outline: string;
    attachments: string;
    layers: string;
  };
  states: {
    empty: string;
    emptyDescription: string;
    loading: string;
    error: string;
    unsupported: string;
    unsupportedDescription: string;
  };
  dialog: {
    close: string;
    passwordPrompt: string;
    passwordInput: string;
    passwordSubmit: string;
    properties: string;
    title: string;
    author: string;
    subject: string;
    creator: string;
    producer: string;
    creationDate: string;
    modificationDate: string;
    pages: string;
    fileSize: string;
  };
}

export type LocaleKey = string;
export type LocaleLoader = (locale: string) => Promise<ViewerStrings>;
