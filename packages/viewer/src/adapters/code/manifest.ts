import type { AdapterManifest } from '../../core/types';

export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  json: 'json', yaml: 'yaml', yml: 'yaml',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust',
  java: 'java', c: 'c', cpp: 'cpp', h: 'c',
  css: 'css', scss: 'scss', less: 'less',
  vue: 'vue', svelte: 'svelte', php: 'php',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  sql: 'sql', dockerfile: 'dockerfile',
};

export const codeManifest: AdapterManifest = {
  id: 'code',
  label: 'Source Code',
  extensions: Object.keys(LANGUAGE_BY_EXTENSION),
  mimeTypes: [
    'text/typescript', 'text/javascript', 'application/json',
    'text/yaml', 'text/x-yaml', 'text/python',
    'text/x-shellscript', 'text/sql',
  ],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M5 7l-3 3 3 3-1 1L0 10l4-4 1 1zm6 0l3 3-3 3 1 1 4-4-4-4-1 1zm-2.5-5L7 14l-1-.2L8.5 2l1 .2z"/></svg>`,
  features: {
    search: true,
    annotations: false,
    textSelection: true,
    print: true,
    thumbnails: false,
    outline: false,
    zoom: true,
    rotation: false,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 80,
  protocolVersion: 1,
};
