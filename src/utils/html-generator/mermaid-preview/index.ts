import * as vscode from 'vscode';
import { generateWebviewHtml } from '../base-webview';

/**
 * Generate HTML for Mermaid preview panel
 * Uses the unified webview approach - loads the React bundle with mermaid preview flags
 * 
 * @param webview - The webview instance
 * @param extensionUri - Extension URI for loading webview assets
 * @param code - Mermaid diagram code
 * @param id - Optional unique ID for the preview panel
 */
export function getMermaidPreviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  code: string,
  id?: string
): string {
  return generateWebviewHtml(webview, extensionUri, {
    title: 'Mermaid Preview',
    isMermaidPreview: true,
    mermaidCode: code,
    mermaidId: id,
  });
}