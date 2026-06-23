/* ============================================================
 * useFileInput — file picker + drag-drop helper
 * ============================================================ */

import { useCallback, useRef, useState } from 'react';
import type { FileSource } from '../core/types';

interface UseFileInputOptions {
  accept?: string[];
  onFile: (source: FileSource) => void;
}

export function useFileInput(options: UseFileInputOptions) {
  const { accept, onFile } = options;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFile({ kind: 'file', file });
      }
      e.target.value = '';
    },
    [onFile],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      if (accept) {
        const filtered = files.filter((f) => {
          const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
          return accept.some((a) => {
            if (a.startsWith('.')) return ext === a.slice(1);
            return f.type === a;
          });
        });
        if (filtered.length > 0) {
          onFile({ kind: 'file', file: filtered[0] });
        }
      } else {
        onFile({ kind: 'file', file: files[0] });
      }
    },
    [accept, onFile],
  );

  const dragProps = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  return {
    inputRef,
    isDragging,
    openPicker,
    handleInputChange,
    dragProps,
  };
}
