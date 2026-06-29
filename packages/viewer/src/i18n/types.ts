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
    /** Live-region announcement, e.g. "Page {0} of {1}". */
    pageStatus: string;
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
    region: string;
    viewSwitcher: string;
    resize: string;
  };
  states: {
    empty: string;
    emptyDescription: string;
    openPrompt: string;
    loading: string;
    error: string;
    retry: string;
    unsupported: string;
    unsupportedDescription: string;
    /** Templated with the offending format, e.g. 'Format "{0}" is not supported'. */
    unsupportedFormat: string;
  };
  dialog: {
    close: string;
    cancel: string;
    passwordPrompt: string;
    passwordInput: string;
    passwordSubmit: string;
    passwordTitle: string;
    /** Templated with the file name. */
    passwordDescription: string;
    passwordEmpty: string;
    passwordIncorrect: string;
    properties: string;
    fileName: string;
    format: string;
    mimeType: string;
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
