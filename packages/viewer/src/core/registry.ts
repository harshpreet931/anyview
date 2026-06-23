/* ============================================================
 * Adapter Registry Implementation
 * Singleton registry with synchronous manifest access
 * and lazy async adapter loading.
 * ============================================================ */

import type {
  Adapter,
  AdapterConstructor,
  AdapterLoader,
  AdapterManifest,
  AdapterRegistry,
  FormatId,
} from './types';
import { detectFormat as detectFormatByExt } from './format-detect';

const PROTOCOL_VERSION = 1;

export function createRegistry(): AdapterRegistry {
  const manifests = new Map<FormatId, AdapterManifest>();
  const loaders = new Map<FormatId, AdapterLoader>();
  // Cache the imported constructor (one dynamic import per format), but
  // construct a NEW instance on every loadAdapter() so each document/viewer
  // gets isolated adapter state.
  const loadedClasses = new Map<FormatId, AdapterConstructor>();
  const listeners = new Set<(manifest: AdapterManifest) => void>();

  return {
    register(manifest: AdapterManifest, loader: AdapterLoader): void {
      if (manifest.protocolVersion !== PROTOCOL_VERSION) {
        throw new Error(
          `Adapter "${manifest.id}" uses protocol version ${manifest.protocolVersion}, ` +
          `but the registry expects version ${PROTOCOL_VERSION}. ` +
          `Please update the adapter to match.`,
        );
      }

      const existing = manifests.get(manifest.id);
      if (existing && existing.priority > manifest.priority) {
        return;
      }

      manifests.set(manifest.id, manifest);
      loaders.set(manifest.id, loader);

      // A re-registered format may resolve to a different module; drop any
      // cached constructor so the next load re-imports.
      loadedClasses.delete(manifest.id);

      for (const cb of listeners) {
        cb(manifest);
      }
    },

    getManifests(): readonly AdapterManifest[] {
      return Array.from(manifests.values());
    },

    detectFormat(filename: string, mimeType?: string): FormatId | null {
      return detectFormatByExt(filename, mimeType);
    },

    getManifest(format: FormatId): AdapterManifest | null {
      return manifests.get(format) ?? null;
    },

    async loadAdapter(format: FormatId): Promise<Adapter> {
      let Ctor = loadedClasses.get(format);

      if (!Ctor) {
        const loader = loaders.get(format);
        if (!loader) {
          throw new Error(`No adapter registered for format "${format}".`);
        }

        const mod = await loader();
        Ctor = mod.default;

        if (typeof Ctor !== 'function') {
          throw new Error(
            `Adapter module for "${format}" must default-export an Adapter ` +
            `class (a constructor), not an instance.`,
          );
        }

        loadedClasses.set(format, Ctor);
      }

      const adapter = new Ctor();

      if (!adapter.manifest) {
        throw new Error(
          `Adapter for "${format}" does not expose a manifest.`,
        );
      }

      return adapter;
    },

    unloadAdapter(format: FormatId): void {
      // Instances are owned by their document (disposed on close); only the
      // cached constructor lives here, so unloading just frees the import.
      loadedClasses.delete(format);
    },

    onRegister(cb: (manifest: AdapterManifest) => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
