/**
 * Text utility functions for ripgrep output processing
 */

import { MAX_LINE_LENGTH } from './constants';

/**
 * Truncates a line if it exceeds the maximum length
 */
export function truncateLine(line: string, maxLength: number = MAX_LINE_LENGTH): string {
    return line.length > maxLength ? line.substring(0, maxLength) + ' [truncated...]' : line;
}