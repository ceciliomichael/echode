import type { ToolExecutionResult, EchoSearchProgress } from '../types/tool';

/**
 * Progress callback type for tools that support streaming progress
 */
export type ToolProgressCallback = (progress: EchoSearchProgress) => void;

/**
 * Execute tool via VSCode extension backend
 */
export async function executeToolViaExtension(
  toolName: string,
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
  onProgress?: ToolProgressCallback,
): Promise<ToolExecutionResult> {
  return new Promise((resolve, reject) => {
    if (!window.vscode) {
      reject(new Error('VSCode API not available'));
      return;
    }

    const requestId = Math.random().toString(36).substring(7);
    
    const handleResponse = (event: MessageEvent) => {
      const message = event.data;
      
      // Handle progress updates
      if (message.type === 'toolExecutionProgress' && message.requestId === requestId) {
        if (onProgress) {
          onProgress(message.progress as EchoSearchProgress);
        }
        return;
      }
      
      // Handle final result
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
      window.vscode.postMessage({
        type: 'abortToolExecution',
        requestId,
        toolName,
      });
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
