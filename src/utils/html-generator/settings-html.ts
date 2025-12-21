import * as vscode from 'vscode';
import { generateWebviewHtml } from './base-webview';

/**
 * Generate HTML for settings panel
 */
export function getSettingsHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  return generateWebviewHtml(webview, extensionUri, {
    title: 'EchoDE Settings',
    isSettingsPanel: true,
  });
}