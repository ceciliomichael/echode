import type { ToolExecutionResult } from '../types/tool';

/**
 * Patterns that indicate internal tool protocol or system instructions
 * These should NEVER be written into workspace files
 */
const FORBIDDEN_CONTENT_PATTERNS = [
  /<function_calls>/,
  /<invoke\s+name=/,
  /<parameter\s+name=/,
  /<tool_calling>/,
  /<tool_format_critical>/,
  /<available_tools>/,
  /<file_operations>/,
  /<enabled_tools>/,
  /<efficiency_principles>/,
  /<system_reminder>/,
];

/**
 * Screen content for forbidden internal protocol patterns
 * Returns error message if forbidden content detected, null if safe
 */
function screenContentForProtocol(content: string): string | null {
  if (typeof content !== 'string') return null;
  
  for (const pattern of FORBIDDEN_CONTENT_PATTERNS) {
    if (pattern.test(content)) {
      return `Writing internal tool protocol or system instructions into workspace files is forbidden. Remove internal XML tags (e.g., <function_calls>, <invoke>, <parameter>, <tool_calling>, etc.) and try again.`;
    }
  }
  return null;
}

/**
 * Screen file-writing tool parameters for forbidden content
 * Returns error result if forbidden content detected, null if safe
 */
function screenFileWriteParams(
  toolName: string,
  parameters: Record<string, unknown>,
): ToolExecutionResult | null {
  // Only screen file-writing tools
  if (toolName !== 'write_to_file' && toolName !== 'apply_diff') {
    return null;
  }
  
  // Check content parameter (write_to_file)
  if (toolName === 'write_to_file' && typeof parameters.content === 'string') {
    const error = screenContentForProtocol(parameters.content);
    if (error) {
      return { success: false, error };
    }
  }
  
  // Check diff parameter (apply_diff)
  if (toolName === 'apply_diff' && typeof parameters.diff === 'string') {
    const error = screenContentForProtocol(parameters.diff);
    if (error) {
      return { success: false, error };
    }
  }
  
  return null;
}

/**
 * Execute tool via VSCode extension backend
 */
export async function executeToolViaExtension(
  toolName: string,
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  // Screen file-writing tools for forbidden internal protocol content
  const screenResult = screenFileWriteParams(toolName, parameters);
  if (screenResult) {
    console.log(`[ToolUtils] ⚠️ Blocked ${toolName}: forbidden content detected`);
    return screenResult;
  }
  return new Promise((resolve, reject) => {
    if (!window.vscode) {
      reject(new Error('VSCode API not available'));
      return;
    }

    const requestId = Math.random().toString(36).substring(7);
    
    const handleResponse = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'toolExecutionResult' && message.requestId === requestId) {
        window.removeEventListener('message', handleResponse);
        if (message.result.success) {
          resolve(message.result);
        } else {
          reject(new Error(message.result.error || 'Tool execution failed'));
        }
      }
    };

    const handleAbort = () => {
      window.removeEventListener('message', handleResponse);
      reject(new Error('Tool execution aborted'));
    };

    if (signal) {
      signal.addEventListener('abort', handleAbort, { once: true });
    }

    window.addEventListener('message', handleResponse);

    window.vscode.postMessage({
      type: 'executeTool',
      requestId,
      toolName,
      parameters,
    });
  });
}
