import * as vscode from 'vscode';
import { getSettingsService, type ApiSettings } from '../../services/settings-service';

/**
 * Settings Handler
 * Handles API settings and chat mode persistence
 */

interface SettingsData {
  settings?: Partial<ApiSettings>;
  mode?: string;
}

type WebviewTarget = vscode.WebviewView | vscode.WebviewPanel;

/**
 * Get current workspace path
 */
function getWorkspacePath(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  return workspaceFolders && workspaceFolders.length > 0
    ? workspaceFolders[0].uri.fsPath
    : undefined;
}

/**
 * Get API settings
 */
export async function handleGetApiSettings(
  _data: SettingsData,
  webview: WebviewTarget
): Promise<void> {
  const workspacePath = getWorkspacePath();
  const apiSettings = getSettingsService().getEffectiveSettings(workspacePath);
  webview.webview.postMessage({
    type: 'apiSettingsLoaded',
    settings: apiSettings
  });
}

/**
 * Save API settings
 */
export async function handleSaveApiSettings(
  data: SettingsData,
  webview: WebviewTarget
): Promise<void> {
  const workspacePath = getWorkspacePath();
  getSettingsService().saveEffectiveSettings(workspacePath, data.settings as ApiSettings);
  webview.webview.postMessage({ type: 'apiSettingsSaved' });
}

/**
 * Clear API settings
 */
export async function handleClearApiSettings(
  _data: SettingsData,
  webview: WebviewTarget
): Promise<void> {
  getSettingsService().clearSettings();
  webview.webview.postMessage({ type: 'apiSettingsCleared' });
}

/**
 * Get chat mode for current workspace
 */
export async function handleGetChatMode(
  _data: SettingsData,
  webview: WebviewTarget
): Promise<void> {
  const workspacePath = getWorkspacePath();
  const chatMode = getSettingsService().getChatMode(workspacePath);
  webview.webview.postMessage({
    type: 'chatModeLoaded',
    mode: chatMode
  });
}

/**
 * Save chat mode for current workspace
 */
export async function handleSaveChatMode(
  data: SettingsData,
  webview: WebviewTarget
): Promise<void> {
  const workspacePath = getWorkspacePath();
  if (data.mode) {
    getSettingsService().setChatMode(workspacePath, data.mode);
  }
  webview.webview.postMessage({ type: 'chatModeSaved' });
}