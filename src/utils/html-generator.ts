import * as vscode from 'vscode';
import * as fs from 'fs';
import { getWorkspaceFiles, getAgentsConfig } from './workspace-scanner';

/**
 * Generate HTML for webview with proper asset URIs and CSP
 */
function generateWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  options: {
    title: string;
    isSettingsPanel?: boolean;
    workspaceInfo?: {
      path: string;
      name: string;
      files: string[];
      agentsConfig: string | null;
    } | null;
  }
): string {
  const distPath = vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist');
  const indexPath = vscode.Uri.joinPath(distPath, 'index.html');

  let html = '';
  try {
    html = fs.readFileSync(indexPath.fsPath, 'utf8');
  } catch (error) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
</head>
<body>
  <div style="padding: 20px;">
    <h2>Build Error</h2>
    <p>Please build the webview-ui first:</p>
    <pre>cd webview-ui && npm run build</pre>
  </div>
</body>
</html>`;
  }

  // Replace asset paths with webview URIs
  html = html.replace(
    /(<link.+?href="|<script.+?src="|<img.+?src=")(?!https?:\/\/)(\.?\/)(.+?)"/g,
    (_match, prefix, _slash, assetPath) => {
      const assetUri = webview.asWebviewUri(
        vscode.Uri.joinPath(distPath, assetPath)
      );
      return `${prefix}${assetUri}"`;
    }
  );

  const theme = vscode.window.activeColorTheme;

  // Build script content
  let scriptContent = `
    window.vscode = acquireVsCodeApi();
    window.vsCodeTheme = {
      kind: ${theme.kind}
    };`;

  if (options.isSettingsPanel) {
    scriptContent += '\n    window.isSettingsPanel = true;';
  }

  if (options.workspaceInfo) {
    scriptContent += `\n    window.workspaceContext = ${JSON.stringify(options.workspaceInfo)};`;
  }

  // Insert CSP and scripts
  html = html.replace(
    '<head>',
    `<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-inline'; connect-src http: https:;">
    <script>${scriptContent}
    </script>`
  );

  return html;
}

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

/**
 * Generate HTML for settings panel
 */
export function getSettingsHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  return generateWebviewHtml(webview, extensionUri, {
    title: 'Echode Settings',
    isSettingsPanel: true,
  });
}

