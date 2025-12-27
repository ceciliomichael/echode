import * as vscode from 'vscode';
import * as fs from 'fs';

/**
 * Approval data for Manual Mode tool confirmation
 */
export interface ApprovalData {
  requestId: string;
  toolName: string;
  title: string;
  message: string;
  diff?: {
    oldContent: string | null;
    newContent: string;
    fileName: string;
  };
  command?: string;
}

export interface WebviewHtmlOptions {
  title: string;
  isSettingsPanel?: boolean;
  isPlanViewer?: boolean;
  planContent?: string;
  isToolApproval?: boolean;
  approvalData?: ApprovalData;
  workspaceInfo?: {
    path: string;
    name: string;
    files: string[];
    agentsConfig: string | null;
  } | null;
}

/**
 * Generate HTML for webview with proper asset URIs and CSP
 */
export function generateWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  options: WebviewHtmlOptions
): string {
  const distPath = vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist');
  const indexPath = vscode.Uri.joinPath(distPath, 'index.html');

  let html = '';
  try {
    html = fs.readFileSync(indexPath.fsPath, 'utf8');
  } catch (_error) {
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

  if (options.isPlanViewer) {
    scriptContent += '\n    window.isPlanViewer = true;';
    if (options.planContent) {
      scriptContent += `\n    window.planContent = ${JSON.stringify(options.planContent)};`;
    }
  }

  if (options.isToolApproval) {
    scriptContent += '\n    window.isToolApproval = true;';
    if (options.approvalData) {
      scriptContent += `\n    window.approvalData = ${JSON.stringify(options.approvalData)};`;
    }
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