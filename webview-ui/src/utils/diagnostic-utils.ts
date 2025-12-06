/**
 * Check if tool is a file modification tool
 */
export function isFileModificationTool(toolName: string): boolean {
  return toolName === 'write_to_file' || toolName === 'apply_diff';
}

/**
 * Extract diagnostics message from tool result (Roo Code approach)
 * File modification tools include newProblemsMessage in their result data
 */
export function extractDiagnosticsFromResult(
  toolName: string,
  result?: { success: boolean; data?: unknown }
): string {
  if (!result?.success || !result.data) {
    return '';
  }

  // Only file modification tools include newProblemsMessage
  if (!isFileModificationTool(toolName)) {
    return '';
  }

  const data = result.data as Record<string, unknown>;
  const newProblemsMessage = data.newProblemsMessage as string | undefined;

  return newProblemsMessage || '';
}
