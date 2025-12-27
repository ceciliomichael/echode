import type { ToolExecutionResult, EchoSearchProgress } from '../types/tool';
import type { ChatMode } from '../types/chat-mode';

export type { ChatMode };

/**
 * Progress data type - can be EchoSearchProgress for echo_search or string for terminal output
 */
export type ToolProgress = EchoSearchProgress | string;

/**
 * Progress callback type for tools that support streaming progress
 */
export type ToolProgressCallback = (progress: ToolProgress) => void;

/**
 * Execute tool via VSCode extension backend
 */
export async function executeToolViaExtension(
  toolName: string,
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
  onProgress?: ToolProgressCallback,
  mode?: ChatMode,
): Promise<ToolExecutionResult> {
  return new Promise((resolve, reject) => {
    if (!window.vscode) {
      reject(new Error('VSCode API not available'));
      return;
    }

    // Check if already aborted before starting
    if (signal?.aborted) {
      reject(new Error('Tool execution aborted'));
      return;
    }

    const requestId = Math.random().toString(36).substring(7);
    let isCompleted = false;

    const cleanup = () => {
      isCompleted = true;
      window.removeEventListener('message', handleResponse);
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }
    };

    const handleResponse = (event: MessageEvent) => {
      const message = event.data;

      // Handle progress updates
      if (message.type === 'toolExecutionProgress' && message.requestId === requestId) {
        if (onProgress) {
          onProgress(message.progress as ToolProgress);
        }
        return;
      }

      // Handle final result
      if (message.type === 'toolExecutionResult' && message.requestId === requestId) {
        cleanup();
        // Always resolve with the result - let the caller handle success/failure
        // This allows proper detection of rejection vs other errors
        resolve(message.result);
      }
    };

    const handleAbort = () => {
      if (isCompleted) {return;} // Already completed, ignore abort
      cleanup();
      // Send abort message to extension backend
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
      mode,
    });
  });
}

