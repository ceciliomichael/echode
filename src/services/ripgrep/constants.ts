/**
 * Ripgrep configuration constants
 */

export const isWindows = process.platform.startsWith('win');
export const binName = isWindows ? 'rg.exe' : 'rg';

// Search limits
export const MAX_RESULTS = 300;
export const MAX_LINE_LENGTH = 500;