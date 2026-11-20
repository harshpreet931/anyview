import { useEffect, useRef, useState } from 'react';

export function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return false;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
    return true;
  };

  return { copied, copy };
}
