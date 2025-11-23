import type { CapturedDiagnostic } from '../types/tool';

/**
 * Fetch diagnostics from backend
 */
export async function fetchDiagnostics(
  filePath: string,
  absolutePath: string
): Promise<CapturedDiagnostic[]> {
  return new Promise((resolve) => {
    const requestId = `diag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'diagnosticsFetched' && message.requestId === requestId) {
        window.removeEventListener('message', messageHandler);
        resolve(message.diagnostics || []);
      }
    };

    window.addEventListener('message', messageHandler);

    window.vscode.postMessage({
      type: 'fetchDiagnostics',
      requestId,
      filePath,
      absolutePath,
    });

    // Fallback timeout slightly longer than backend timeout (2500ms) to allow for message passing
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      resolve([]);
    }, 3000);
  });
}

/**
 * Format diagnostics for AI context
 */
export function formatDiagnosticsForAI(
  diagnostics: CapturedDiagnostic[],
  filePath: string,
  isFileModificationTool: boolean,
  currentAttempts: number,
  maxIterations: number
): string {
  if (!diagnostics || diagnostics.length === 0) return '';

  const diagnosticLines = diagnostics.map((d) => {
    const source = d.source ? ` (${d.source})` : '';
    const code = d.code ? ` [${d.code}]` : '';
    return `- Line ${d.line}: [${d.severity}] ${d.message}${code}${source}`;
  });

  let instruction = '';
  if (isFileModificationTool) {
    if (currentAttempts < maxIterations) {
      instruction = `[INSTRUCTION: The file you just modified has lint/compile errors. Review the diagnostics above and use write_to_file to fix them. This is attempt ${currentAttempts}/${maxIterations}.]`;
    } else if (currentAttempts === maxIterations) {
      instruction = `[INSTRUCTION: The file still has lint/compile errors. This is your final attempt (${currentAttempts}/${maxIterations}). Review carefully and fix all issues.]`;
    } else {
      instruction = `[NOTE: Maximum fix attempts (${maxIterations}) reached for this file. Diagnostics are shown for your reference, but you should acknowledge and move forward unless the user requests further fixes.]`;
    }
  } else {
    instruction = `[NOTE: This file has ${diagnostics.length} lint/compile error(s). Consider these when analyzing or modifying the file.]`;
  }

  return `\n\n<file_diagnostics>
File: ${filePath}
Issues detected${isFileModificationTool ? ' after your edit' : ''} (${diagnostics.length} total):

${diagnosticLines.join('\n')}

${instruction}
</file_diagnostics>`;
}

/**
 * Check if tool needs diagnostics
 */
export function shouldFetchDiagnostics(toolName: string): boolean {
  return (
    toolName === 'write_to_file' ||
    toolName === 'apply_diff' ||
    toolName === 'read_file'
  );
}

/**
 * Check if tool is a file modification tool
 */
export function isFileModificationTool(toolName: string): boolean {
  return toolName === 'write_to_file' || toolName === 'apply_diff';
}
