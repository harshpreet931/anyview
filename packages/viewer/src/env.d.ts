declare module '*?url' {
  const url: string;
  export default url;
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}
