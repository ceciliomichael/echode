import * as vscode from 'vscode';
import { openFileInBackground } from '../../services/tools/utils/editor-utils';

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
  if (!data.absolutePath) {
    return;
  }
  const fileUri = vscode.Uri.file(data.absolutePath);
  await openFileInBackground(fileUri);
}

/**
 * Handle history panel closed event
 * Returns the new isHistoryOpen state
 */
export function handleHistoryPanelClosed(): boolean {
  return false;
}