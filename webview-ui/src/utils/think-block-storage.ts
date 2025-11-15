/**
 * Storage utilities for persisting think block durations
 */

export interface ThinkBlockDuration {
  duration: number;
  timestamp: number;
}

export type ThinkBlockDurations = Record<string, ThinkBlockDuration>;

const STORAGE_KEY = 'think_block_durations';

/**
 * Generate a stable key for a think block using content hash
 */
export function generateThinkBlockKey(
  _messageId: string | number,
  thinkContent: string
): string {
  const contentHash = thinkContent
    .split('')
    .reduce((acc, char) => {
      const hash = ((acc << 5) - acc + char.charCodeAt(0)) | 0;
      return hash;
    }, 0)
    .toString(36);
  return contentHash;
}

/**
 * Load all think block durations from localStorage
 */
export function loadDurations(): ThinkBlockDurations {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as ThinkBlockDurations;
    }
  } catch {
    // Ignore parse errors
  }

  return {};
}

/**
 * Save think block durations to localStorage
 */
export function saveDurations(durations: ThinkBlockDurations): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(durations));
  } catch {
    // Ignore save errors (e.g., quota exceeded)
  }
}

/**
 * Get duration for a specific think block
 */
export function getThinkBlockDuration(
  messageId: string | number,
  thinkContent: string
): number {
  const key = generateThinkBlockKey(messageId, thinkContent);
  const durations = loadDurations();
  return durations[key]?.duration || 0;
}

/**
 * Set duration for a specific think block
 */
export function setThinkBlockDuration(
  messageId: string | number,
  thinkContent: string,
  duration: number
): void {
  const key = generateThinkBlockKey(messageId, thinkContent);
  const durations = loadDurations();
  durations[key] = {
    duration,
    timestamp: Date.now(),
  };
  saveDurations(durations);
}

/**
 * Clear old durations from localStorage (optional cleanup utility)
 * Call this periodically to prevent storage bloat
 * 
 * @param daysOld - Remove durations older than this many days (default: 30)
 */
export function clearOldThinkBlockDurations(daysOld: number = 30): void {
  const durations = loadDurations();
  const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

  const filtered: ThinkBlockDurations = {};
  for (const [key, value] of Object.entries(durations)) {
    if (value.timestamp > cutoffTime) {
      filtered[key] = value;
    }
  }

  saveDurations(filtered);
}
