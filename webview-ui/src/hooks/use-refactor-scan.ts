import { useState, useEffect } from 'react';
import type { LargeFileInfo } from '../components/ui/refactor-indicator';

declare global {
  interface Window {
    refactorScanResults: LargeFileInfo[] | null | undefined;
    refactorScanComplete: boolean | undefined;
    __echodeRefactorListenerRegistered?: boolean;
    __echodeRefactorScanReceivedAt?: number;
  }
}

// Minimum delay (ms) before showing scan results - ensures workspace files load first
const MIN_SCAN_DELAY = 800;

// Global listener so we always cache latest scan results, even before React mounts
if (typeof window !== 'undefined' && !window.__echodeRefactorListenerRegistered) {
  window.__echodeRefactorListenerRegistered = true;

  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    if (message && message.type === 'refactorScanResults') {
      window.refactorScanResults = message.largeFiles || [];
      window.refactorScanComplete = true;
      window.__echodeRefactorScanReceivedAt = Date.now();
    }
  });
}

export interface RefactorScanResult {
  largeFiles: LargeFileInfo[];
  isScanning: boolean;
}

export function useRefactorScan(): RefactorScanResult {
  const [largeFiles, setLargeFiles] = useState<LargeFileInfo[]>(() => {
    if (!window.refactorScanComplete) {
      return [];
    }

    const receivedAt = window.__echodeRefactorScanReceivedAt ?? Date.now();
    const elapsed = Date.now() - receivedAt;

    if (elapsed >= MIN_SCAN_DELAY) {
      const initial = window.refactorScanResults || [];
      return initial;
    }

    return [];
  });
  const [isScanning, setIsScanning] = useState(() => {
    if (!window.refactorScanComplete) {
      return true;
    }

    const receivedAt = window.__echodeRefactorScanReceivedAt ?? Date.now();
    const elapsed = Date.now() - receivedAt;
    return elapsed < MIN_SCAN_DELAY;
  });

  useEffect(() => {
    let delayTimer: number | null = null;

    const scheduleApplyResults = () => {
      if (!window.refactorScanComplete) {
        return;
      }

      const receivedAt = window.__echodeRefactorScanReceivedAt ?? Date.now();
      const elapsed = Date.now() - receivedAt;
      const remainingDelay = Math.max(0, MIN_SCAN_DELAY - elapsed);

      // Always defer state updates via timeout (0ms is fine) to avoid sync setState in effect
      if (delayTimer !== null) {
        window.clearTimeout(delayTimer);
      }

      delayTimer = window.setTimeout(() => {
        setLargeFiles(window.refactorScanResults || []);
        setIsScanning(false);
      }, remainingDelay);
    };

    // If results were already cached before mount, schedule them now
    if (window.refactorScanComplete) {
      scheduleApplyResults();
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'refactorScanResults') {
        window.refactorScanResults = message.largeFiles || [];
        window.refactorScanComplete = true;
        window.__echodeRefactorScanReceivedAt = Date.now();

        scheduleApplyResults();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (delayTimer !== null) {
        window.clearTimeout(delayTimer);
      }
    };
  }, []);

  return { largeFiles, isScanning };
}
