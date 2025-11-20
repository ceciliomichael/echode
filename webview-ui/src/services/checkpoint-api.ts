import type { WorkspaceCheckpoint } from '../types/chat';

declare const vscode: {
  postMessage: (message: unknown) => void;
};

let requestIdCounter = 0;

/**
 * Checkpoint API for communicating with extension
 */
export const checkpointApi = {
  /**
   * Capture current workspace state as checkpoint
   */
  async captureCheckpoint(): Promise<WorkspaceCheckpoint> {
    return new Promise((resolve, reject) => {
      const requestId = `checkpoint_${Date.now()}_${requestIdCounter++}`;
      
      const handler = (event: MessageEvent) => {
        const message = event.data;
        if (message.requestId === requestId) {
          window.removeEventListener('message', handler);
          
          if (message.type === 'checkpointCaptured') {
            resolve(message.checkpoint);
          } else if (message.type === 'checkpointError') {
            reject(new Error(message.error));
          }
        }
      };
      
      window.addEventListener('message', handler);
      
      vscode.postMessage({
        type: 'captureCheckpoint',
        requestId
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Checkpoint capture timeout'));
      }, 30000);
    });
  },

  /**
   * Restore workspace to checkpoint state
   */
  async restoreCheckpoint(checkpoint: WorkspaceCheckpoint, isTemporary: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = `restore_${Date.now()}_${requestIdCounter++}`;
      
      const handler = (event: MessageEvent) => {
        const message = event.data;
        if (message.requestId === requestId) {
          window.removeEventListener('message', handler);
          
          if (message.type === 'checkpointRestored') {
            resolve();
          } else if (message.type === 'checkpointError') {
            reject(new Error(message.error));
          }
        }
      };
      
      window.addEventListener('message', handler);
      
      vscode.postMessage({
        type: 'restoreCheckpoint',
        checkpoint,
        isTemporary,
        requestId
      });
      
      // Timeout after 60 seconds (restore can take longer)
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Checkpoint restore timeout'));
      }, 60000);
    });
  },

  /**
   * Undo temporary checkpoint restore
   */
  async undoCheckpoint(): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = `undo_${Date.now()}_${requestIdCounter++}`;
      
      const handler = (event: MessageEvent) => {
        const message = event.data;
        if (message.requestId === requestId) {
          window.removeEventListener('message', handler);
          
          if (message.type === 'checkpointUndone') {
            resolve();
          } else if (message.type === 'checkpointError') {
            reject(new Error(message.error));
          }
        }
      };
      
      window.addEventListener('message', handler);
      
      vscode.postMessage({
        type: 'undoCheckpoint',
        requestId
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Checkpoint undo timeout'));
      }, 60000);
    });
  },

  /**
   * Commit temporary checkpoint restore (make it permanent)
   */
  commitCheckpoint(): void {
    vscode.postMessage({
      type: 'commitCheckpoint'
    });
  }
};
