/**
 * Diagnostics Handler Module
 * 
 * Responsible for extracting and processing diagnostics from tool execution results.
 * Implements attempt tracking to prevent infinite fix loops.
 */
import { isFileModificationTool, extractDiagnosticsFromResult } from '../../utils/diagnostic-utils';
import type { ToolExecutionState } from '../../types/tool';

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

  const newProblemsMessage = extractDiagnosticsFromResult(executedTool.toolName, executedTool.result);
  
  if (newProblemsMessage) {
    return buildDiagnosticsWithInstruction(
      newProblemsMessage,
      filePath,
      diagnosticAttemptsRef
    );
  } else {
    resetDiagnosticAttempts(filePath, diagnosticAttemptsRef);
    return '';
  }
}

/**
 * Extract diagnostics from multiple tool results (parallel execution)
 */
export function getDiagnosticsFromToolResultsParallel(
  executedTools: Array<{ toolName: string; result?: { success: boolean; data?: unknown }; state: ToolExecutionState }>,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): string[] {
  console.log(`[DiagnosticsHandler] Processing diagnostics for ${executedTools.length} files...`);

  const results = executedTools.map(({ toolName, result }) => {
    if (!result?.success || !('data' in result) || !result.data) {
      return '';
    }

    const data = result.data as Record<string, unknown>;
    const filePath = (data.path as string) || 'unknown';
    const isModificationTool = isFileModificationTool(toolName);

    if (!isModificationTool) {
      return '';
    }

    const newProblemsMessage = extractDiagnosticsFromResult(toolName, result);
    
    if (newProblemsMessage) {
      return buildDiagnosticsWithInstruction(
        newProblemsMessage,
        filePath,
        diagnosticAttemptsRef
      );
    } else {
      resetDiagnosticAttempts(filePath, diagnosticAttemptsRef);
      return '';
    }
  });

  console.log(`[DiagnosticsHandler] Completed diagnostics processing for ${executedTools.length} files`);
  return results.filter((r): r is string => r.length > 0);
}

/**
 * Build diagnostics message with attempt tracking instruction
 */
function buildDiagnosticsWithInstruction(
  newProblemsMessage: string,
  filePath: string,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): string {
  const currentAttempts = (diagnosticAttemptsRef.current[filePath] || 0) + 1;
  diagnosticAttemptsRef.current[filePath] = currentAttempts;

  let instruction = '';
  if (currentAttempts < MAX_DIAGNOSTIC_ITERATIONS) {
    instruction = `\n\n[INSTRUCTION: The file you just modified has lint/compile errors. Review the diagnostics above and fix them. This is attempt ${currentAttempts}/${MAX_DIAGNOSTIC_ITERATIONS}.]`;
  } else if (currentAttempts === MAX_DIAGNOSTIC_ITERATIONS) {
    instruction = `\n\n[INSTRUCTION: The file still has lint/compile errors. This is your final attempt (${currentAttempts}/${MAX_DIAGNOSTIC_ITERATIONS}). Review carefully and fix all issues.]`;
  } else {
    instruction = `\n\n[NOTE: Maximum fix attempts (${MAX_DIAGNOSTIC_ITERATIONS}) reached for this file. Diagnostics are shown for your reference, but you should acknowledge and move forward unless the user requests further fixes.]`;
  }

  return newProblemsMessage + instruction;
}

/**
 * Reset diagnostic attempts for a file when no errors are found
 */
function resetDiagnosticAttempts(
  filePath: string,
  diagnosticAttemptsRef: React.MutableRefObject<Record<string, number>>
): void {
  if (diagnosticAttemptsRef.current[filePath]) {
    console.log(`[DiagnosticsHandler] No errors found for ${filePath} - resetting attempt counter`);
    delete diagnosticAttemptsRef.current[filePath];
  }
}