/**
 * Tool result message builder for continuation history
 */

import type { ToolResultMessageOptions } from './types';
import { CONTINUATION_INSTRUCTION, TOOL_OUTPUT_PREFIX } from './constants';
import { truncateDiagnostics } from './diagnostics-utils';

/**
 * Build the tool result message in a structured format
 * Combines tool results, diagnostics, and todo context into a single message
 */
export function buildToolResultMessage(options: ToolResultMessageOptions): string {
  const { toolResultText, diagnosticsText, todoContext, summaryPrefix } = options;

  const boundedDiagnostics = truncateDiagnostics(diagnosticsText);

  let message = summaryPrefix || '';
  message += `${TOOL_OUTPUT_PREFIX}\n<tool_results>\n` + toolResultText + '\n</tool_results>';

  // Add diagnostics section if present
  if (boundedDiagnostics.trim()) {
    message += '\n\n<diagnostics>\n' + boundedDiagnostics + '\n</diagnostics>';
  }

  // Add todo context if present
  if (todoContext.trim()) {
    message += '\n' + todoContext;
  }

  // Simple continuation instruction
  message += '\n\n' + CONTINUATION_INSTRUCTION;

  return message;
}