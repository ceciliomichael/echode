import { useState, useEffect } from 'react';
import type { LargeFileInfo } from '../components/ui/refactor-indicator';

declare global {
  interface Window {
    refactorScanResults: LargeFileInfo[] | null | undefined;
    refactorScanComplete: boolean | undefined;
    __echodeRefactorListenerRegistered?: boolean;
  }
}

// Global listener so we always cache latest scan results, even before React mounts
if (typeof window !== 'undefined' && !window.__echodeRefactorListenerRegistered) {
  window.__echodeRefactorListenerRegistered = true;

  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    if (message && message.type === 'refactorScanResults') {
      window.refactorScanResults = message.largeFiles || [];
      window.refactorScanComplete = true;
    }
  });
}

export interface RefactorScanResult {
  largeFiles: LargeFileInfo[];
  isScanning: boolean;
}

export function useRefactorScan(): RefactorScanResult {
  const [largeFiles, setLargeFiles] = useState<LargeFileInfo[]>(() => {
    const initial = window.refactorScanResults || [];
    console.log('[Refactor] Initial state:', initial.length, 'files, complete:', window.refactorScanComplete);
    return initial;
  });
  const [isScanning, setIsScanning] = useState(() => {
    return !window.refactorScanComplete;
  });

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'refactorScanResults') {
        console.log('[Refactor] Received scan results:', message.largeFiles?.length, 'files');
        setLargeFiles(message.largeFiles || []);
        setIsScanning(false);
        window.refactorScanResults = message.largeFiles || [];
        window.refactorScanComplete = true;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return { largeFiles, isScanning };
}
