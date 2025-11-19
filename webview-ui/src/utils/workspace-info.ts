/**
 * Utility for requesting workspace information from the VSCode extension
 */
export function requestWorkspaceInfo(): Promise<void> {
  return new Promise((resolve) => {
    if (!window.vscode) {
      resolve();
      return;
    }

    const handler = (event: MessageEvent) => {
      if (event.data.type === 'workspaceInfo') {
        window.workspaceContext = event.data.workspace;
        window.removeEventListener('message', handler);
        resolve();
      }
    };

    window.addEventListener('message', handler);
    window.vscode.postMessage({ type: 'requestWorkspaceInfo' });

    // Timeout fallback after 500ms
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve();
    }, 500);
  });
}
