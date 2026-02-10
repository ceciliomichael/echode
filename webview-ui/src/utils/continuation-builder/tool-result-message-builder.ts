/**
 * Tool result message builder for continuation history
 */

import type { ToolResultMessageOptions } from './types';
import { CONTINUATION_INSTRUCTION, TOOL_OUTPUT_PREFIX } from './constants';
import { truncateDiagnostics } from './diagnostics-utils';

/**
 * Build the tool result message in a structured format
 * Combines tool results and diagnostics into a single message
 * Note: Todo reminders are handled by the backend in src/utils/todo-reminder.ts
 */
export function buildToolResultMessage(options: ToolResultMessageOptions): string {
  const { toolResultText, diagnosticsText, summaryPrefix } = options;

  const boundedDiagnostics = truncateDiagnostics(diagnosticsText);

  let message = summaryPrefix || '';
  message += `${TOOL_OUTPUT_PREFIX}\n<tool_results>\n` + toolResultText + '\n</tool_results>';

  // Add diagnostics section if present
  if (boundedDiagnostics.trim()) {
    message += '\n\n<diagnostics>\n' + boundedDiagnostics + '\n</diagnostics>';
  }

  // Simple continuation instruction
  message += '\n\n' + CONTINUATION_INSTRUCTION;

  return message;
}