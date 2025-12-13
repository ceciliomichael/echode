/**
 * Diagnostics utilities for context management
 */

import { MAX_DIAGNOSTICS_CHARS } from './constants';

/**
 * Truncate diagnostics text to stay within context limits
 * Prevents overly large diagnostic output from consuming too much context
 */
export function truncateDiagnostics(diagnosticsText: string): string {
  if (diagnosticsText.length > MAX_DIAGNOSTICS_CHARS) {
    return `${diagnosticsText.slice(0, MAX_DIAGNOSTICS_CHARS)}\n... [truncated]`;
  }
  return diagnosticsText;
}