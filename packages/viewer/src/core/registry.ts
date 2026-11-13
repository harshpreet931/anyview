import type {
  Adapter,
  AdapterConstructor,
  AdapterLoader,
  AdapterManifest,
  AdapterRegistry,
  FormatId,
} from './types';
import { detectFormat as detectFormatByExt, extractExtension, getFormatSpecs } from './format-detect';

const BUILT_IN = new Set<string>(getFormatSpecs().map((s) => s.id));

const PROTOCOL_VERSION = 1;

export function createRegistry(): AdapterRegistry {
  const manifests = new Map<FormatId, AdapterManifest>();
  const loaders = new Map<FormatId, AdapterLoader>();
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

      loadedClasses.delete(manifest.id);

      for (const cb of listeners) {
        cb(manifest);
      }
    },

    getManifests(): readonly AdapterManifest[] {
      return Array.from(manifests.values());
    },

    detectFormat(filename: string, mimeType?: string, head?: Uint8Array): FormatId | null {
      const ext = extractExtension(filename);
      const mime = (mimeType ?? '').split(';')[0]!.trim().toLowerCase();
      let custom: AdapterManifest | null = null;
      for (const m of manifests.values()) {
        if (BUILT_IN.has(m.id)) continue;
        const claims =
          (ext && m.extensions.some((e) => e.toLowerCase() === ext)) ||
          (mime && m.mimeTypes.some((t) => t.toLowerCase() === mime));
        if (claims && (!custom || m.priority > custom.priority)) custom = m;
      }
      return custom ? custom.id : detectFormatByExt(filename, mimeType, head);
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
