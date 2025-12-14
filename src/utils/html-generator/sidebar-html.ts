import * as vscode from 'vscode';
import { generateWebviewHtml } from './base-webview';
import { getWorkspaceFiles, getAgentsConfig } from '../workspace-scanner';

/**
 * Generate HTML for main sidebar webview
 */
export function getMainWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceInfo = workspaceFolders && workspaceFolders.length > 0
    ? {
        path: workspaceFolders[0].uri.fsPath,
        name: workspaceFolders[0].name,
        files: getWorkspaceFiles(workspaceFolders[0].uri.fsPath),
        agentsConfig: getAgentsConfig(workspaceFolders[0].uri.fsPath)
      }
    : null;

  return generateWebviewHtml(webview, extensionUri, {
    title: 'Echode',
    workspaceInfo,
  });
}