// Vite asset-URL imports (e.g. `import url from 'x?url'`) resolved at the
// library's own build time and emitted into dist.
declare module '*?url' {
  const url: string;
  export default url;
}
