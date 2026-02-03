import * as vscode from 'vscode';

export interface OpenInBackgroundOptions {
  preview?: boolean;
}

/**
 * Open file in editor tab without stealing focus from the active editor.
 * Uses vscode.open command with background options for cleaner focus preservation.
 */
export async function openFileInBackground(uri: vscode.Uri, options: OpenInBackgroundOptions = {}): Promise<void> {
  try {
    // Use vscode.open command with background: true to open without stealing focus
    // This is often cleaner than showTextDocument with preserveFocus and avoids manual restoration hacks
    await vscode.commands.executeCommand('vscode.open', uri, {
      preserveFocus: true,
      preview: options.preview ?? false,
      background: true // Explicitly requested for background behavior
    });
  } catch (error) {
    console.warn(`[EditorUtils] Failed to open file in background: ${uri.fsPath}`, error);
    // Don't throw, just log warning so the calling tool doesn't fail its primary task
  }
}