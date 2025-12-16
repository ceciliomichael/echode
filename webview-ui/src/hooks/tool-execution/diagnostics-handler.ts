/**
 * Diagnostics Handler Module
 *
 * Responsible for extracting and processing diagnostics from tool execution results.
 * Implements attempt tracking to prevent infinite fix loops.
 */
import { isFileModificationTool, extractDiagnosticsFromResult } from '../../utils/diagnostic-utils';

const MAX_DIAGNOSTIC_ITERATIONS = 3;

/**
 * Extract diagnostics from a single tool result
 * Only file modification tools (write_to_file, apply_diff) include diagnostics
 */
export function getDiagnosticsFromToolResult(
  executedTool: { toolName: string; result?: { success: boolean; data?: unknown } } | undefined,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): string {
  if (!executedTool?.result?.success || !('data' in executedTool.result) || !executedTool.result.data) {
    return '';
  }

  const data = executedTool.result.data as Record<string, unknown>;
  const filePath = (data.path as string) || 'unknown';
  const isModificationTool = isFileModificationTool(executedTool.toolName);

  if (!isModificationTool) {
    return '';
  }

  const fileDiagnostics = extractDiagnosticsFromResult(executedTool.toolName, executedTool.result);

  if (fileDiagnostics) {
    return buildDiagnosticsWithInstruction(
      fileDiagnostics,
      filePath,
      diagnosticAttemptsRef
    );
  } else {
    resetDiagnosticAttempts(filePath, diagnosticAttemptsRef);
    return '';
  }
}

/**
 * Build diagnostics message with attempt tracking instruction
 */
function buildDiagnosticsWithInstruction(
  fileDiagnostics: string,
  filePath: string,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): string {
  const currentAttempts = (diagnosticAttemptsRef.current[filePath] || 0) + 1;
  diagnosticAttemptsRef.current[filePath] = currentAttempts;

  let instruction = '';
  if (currentAttempts < MAX_DIAGNOSTIC_ITERATIONS) {
    instruction = `\n\n[INSTRUCTION: The file you just modified reports the following lint/compile errors. NOTE: These diagnostics might be stale (from the version before your edit). If you are confident your edit fixed these issues, you may ignore this and verify with get_diagnostics. This is attempt ${currentAttempts}/${MAX_DIAGNOSTIC_ITERATIONS}.]`;
  } else if (currentAttempts === MAX_DIAGNOSTIC_ITERATIONS) {
    instruction = `\n\n[INSTRUCTION: The file still reports lint/compile errors. NOTE: Verify these are not stale. This is your final attempt (${currentAttempts}/${MAX_DIAGNOSTIC_ITERATIONS}). Review carefully.]`;
  } else {
    instruction = `\n\n[NOTE: Maximum fix attempts (${MAX_DIAGNOSTIC_ITERATIONS}) reached for this file. Diagnostics are shown for your reference, but you should acknowledge and move forward unless the user requests further fixes.]`;
  }

  return fileDiagnostics + instruction;
}

/**
 * Reset diagnostic attempts for a file when no errors are found
 */
function resetDiagnosticAttempts(
  filePath: string,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): void {
  if (diagnosticAttemptsRef.current[filePath]) {
    delete diagnosticAttemptsRef.current[filePath];
  }
}