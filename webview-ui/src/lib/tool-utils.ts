import type { ToolExecutionResult, EchoSearchProgress } from '../types/tool';

/**
 * Progress callback type for tools that support streaming progress
 */
export type ToolProgressCallback = (progress: EchoSearchProgress) => void;

/**
 * Chat mode type for mode-specific tool behavior
 */
export type ChatMode = 'agent' | 'plan' | 'ask' | 'general' | 'chat';

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
          onProgress(message.progress as EchoSearchProgress);
        }
        return;
      }

      // Handle final result
      if (message.type === 'toolExecutionResult' && message.requestId === requestId) {
        cleanup();
        if (message.result.success) {
          resolve(message.result);
        } else {
          reject(new Error(message.result.error || 'Tool execution failed'));
        }
      }
    };

    const handleAbort = () => {
      if (isCompleted) return; // Already completed, ignore abort
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

