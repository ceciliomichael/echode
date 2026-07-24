import * as vscode from 'vscode';

/**
 * Ask VS Code's native Explorer to reconcile its tree with the file system.
 *
 * File system watchers normally keep the Explorer current, but an explicit
 * refresh is useful after tool-driven writes and as a fallback when an OS
 * watcher drops an event during a burst of external file operations.
 */
export async function refreshFileExplorer(): Promise<void> {
  try {
    await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
  } catch (error) {
    // Explorer refresh is best-effort and must never fail a file operation.
    console.warn('[EchoDE] Could not refresh the file explorer:', error);
  }
}
