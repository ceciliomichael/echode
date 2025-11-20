import type { ToolExecutionState } from '../types/tool';

declare const vscode: {
  postMessage: (message: unknown) => void;
};

let requestIdCounter = 0;

/**
 * Tool History API for communicating with extension
 */
export const toolHistoryApi = {
  /**
   * Undo tool executions from a message
   */
  async undoToolExecutions(toolExecutions: Map<string, ToolExecutionState>): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = `undo_tools_${Date.now()}_${requestIdCounter++}`;
      
      const handler = (event: MessageEvent) => {
        const message = event.data;
        if (message.requestId === requestId) {
          window.removeEventListener('message', handler);
          
          if (message.type === 'toolExecutionsUndone') {
            if (message.success) {
              resolve();
            } else {
              reject(new Error(`Failed to undo some tools: ${message.errors.join(', ')}`));
            }
          } else if (message.type === 'toolExecutionsError') {
            reject(new Error(message.error));
          }
        }
      };
      
      window.addEventListener('message', handler);
      
      // Convert Map to array for JSON serialization
      const toolExecutionsArray = Array.from(toolExecutions.entries());
      
      vscode.postMessage({
        type: 'undoToolExecutions',
        toolExecutions: toolExecutionsArray,
        requestId
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Tool undo timeout'));
      }, 60000);
    });
  },

  /**
   * Redo tool executions from a message
   */
  async redoToolExecutions(toolExecutions: Map<string, ToolExecutionState>): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = `redo_tools_${Date.now()}_${requestIdCounter++}`;
      
      const handler = (event: MessageEvent) => {
        const message = event.data;
        if (message.requestId === requestId) {
          window.removeEventListener('message', handler);
          
          if (message.type === 'toolExecutionsRedone') {
            if (message.success) {
              resolve();
            } else {
              reject(new Error(`Failed to redo some tools: ${message.errors.join(', ')}`));
            }
          } else if (message.type === 'toolExecutionsError') {
            reject(new Error(message.error));
          }
        }
      };
      
      window.addEventListener('message', handler);
      
      // Convert Map to array for JSON serialization
      const toolExecutionsArray = Array.from(toolExecutions.entries());
      
      vscode.postMessage({
        type: 'redoToolExecutions',
        toolExecutions: toolExecutionsArray,
        requestId
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Tool redo timeout'));
      }, 60000);
    });
  }
};
