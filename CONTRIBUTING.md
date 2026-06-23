# Contributing to Anyview

Thanks for your interest in contributing! This guide will get you up and running.

## Prerequisites

- **Node.js** 20+
- **pnpm** 9.15+ (`npm install -g pnpm`)
- **Git**

## Getting Started

```bash
git clone https://github.com/harshpreet931/anyview.git
cd anyview
pnpm install
```

## Development

```bash
# Start the playground dev server (hot reload)
pnpm dev

# Typecheck all packages
pnpm typecheck

# Build the library
pnpm build

# Clean build artifacts
pnpm clean
```

## Project Structure

```
anyview/
├── packages/viewer/    # The published library (anyview)
└── apps/playground/    # Vite dev app for testing
```

The library uses a **plugin-based adapter architecture**. Each format (PDF, DOCX, XLSX, etc.) has its own adapter that loads on demand via dynamic `import()`. See the **Architecture** section of the [README](./README.md#architecture) for the full design.

## Writing a Custom Adapter

1. Create a new directory under `packages/viewer/src/adapters/your-format/`
2. Implement the `Adapter` interface from `core/types.ts`:

```ts
import type { Adapter, AdapterManifest } from '../../core/types';

export const myFormatManifest: AdapterManifest = {
  id: 'my-format',
  label: 'My Format',
  extensions: ['.mf'],
  mimeTypes: ['application/x-my-format'],
  icon: 'file',
  features: { /* ... */ },
  priority: 0,
  protocolVersion: 1,
};

export const MyFormatAdapter: Adapter = {
  manifest: myFormatManifest,
  async parse(source, signal) { /* return DocumentModel */ },
  async renderPage(ctx) { /* render to canvas/div */ },
  // optional: getTextLayer, search, exportDocument, dispose
};
```

3. Register it in `adapters/index.ts`:

```ts
import { myFormatManifest } from './your-format/MyFormatAdapter';

// In registerBuiltInAdapters():
registry.register(myFormatManifest, () =>
  import('./your-format/MyFormatAdapter').then((m) => m.MyFormatAdapter)
);
```

## Code Style

- **TypeScript strict mode** — `exactOptionalPropertyTypes: true`, `verbatimModuleSyntax: true`
- **No `any` types** — use `unknown` and narrow with type guards
- **Conditional spread** for optional props: `{...(value ? { key: value } : {})}` (due to `exactOptionalPropertyTypes`)
- **No comments** unless explaining a non-obvious design decision
- **Zustand v5** with `subscribeWithSelector` middleware (required for selector-based subscriptions)
- **Comlink** for Web Worker RPC
- **@tanstack/react-virtual** for virtualized scrolling

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add EPUB adapter
fix: correct PDF text layer coordinates
docs: clarify custom adapter guide
refactor: simplify page cache eviction
```

## Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning:

```bash
pnpm changeset      # create a changeset
pnpm changeset version  # apply changesets to package.json
```

## Pull Requests

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Ensure `pnpm typecheck` and `pnpm build` pass
4. Add a changeset: `pnpm changeset`
5. Open a PR with a clear description

## License

MIT — see [LICENSE](./LICENSE)
