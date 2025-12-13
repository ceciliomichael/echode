import * as vscode from 'vscode';

/**
 * UI Handler
 * Handles UI-related messages like notifications and file operations
 */

interface UiData {
  message?: string;
  absolutePath?: string;
}

/**
 * Show information message
 */
export async function handleInfo(
  data: UiData,
  _webview: vscode.WebviewView
): Promise<void> {
  if (data.message) {
    vscode.window.showInformationMessage(data.message);
  }
}

/**
 * Show error message
 */
export async function handleError(
  data: UiData,
  _webview: vscode.WebviewView
): Promise<void> {
  if (data.message) {
    vscode.window.showErrorMessage(data.message);
  }
}

/**
 * Open file in editor tab without stealing focus
 */
export async function handleOpenFileInTab(
  data: UiData,
  _webview: vscode.WebviewView
): Promise<void> {
  try {
    const fileUri = vscode.Uri.file(data.absolutePath!);
    const previousActiveEditor = vscode.window.activeTextEditor;
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document, {
      preview: false,      // Open as permanent tab, not preview
      preserveFocus: true, // Don't steal focus from the sidebar
    });
    // Restore the previously active editor to keep it visible
    if (previousActiveEditor) {
      await vscode.window.showTextDocument(previousActiveEditor.document, {
        viewColumn: previousActiveEditor.viewColumn,
        preserveFocus: true,
      });
    }
  } catch (error) {
    console.warn('[OpenFileInTab] Failed to open file:', data.absolutePath, error);
  }
}

/**
 * Handle history panel closed event
 * Returns the new isHistoryOpen state
 */
export function handleHistoryPanelClosed(): boolean {
  return false;
}