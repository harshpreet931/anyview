import { useCallback, useRef, useState } from 'react';
import type { FileSource } from '../core/types';

interface UseFileInputOptions {
  accept?: string[];
  onFile: (source: FileSource) => void;
}

function accepts(file: File, accept: string[]): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return accept.some((a) => (a.startsWith('.') ? ext === a.slice(1) : file.type === a));
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
      const file = accept ? files.find((f) => accepts(f, accept)) : files[0];
      if (file) onFile({ kind: 'file', file });
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
