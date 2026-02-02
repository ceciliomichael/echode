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
  isMermaidPreview?: boolean;
  mermaidCode?: string;
  mermaidId?: string;
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

  const baseUri = webview.asWebviewUri(distPath);
  const importMap = JSON.stringify({
    imports: {
      '/assets/': `${baseUri.toString()}/assets/`,
    },
  });

  // Replace asset paths with webview URIs
  html = html.replace(
    /(<link.+?href="|<script.+?src="|<img.+?src=")(?!https?:\/\/)(\.?\/|\/)(.+?)"/g,
    (_match, prefix, _slash, assetPath: string) => {
      const normalizedAssetPath = assetPath.startsWith('/')
        ? assetPath.slice(1)
        : assetPath;
      const assetUri = webview.asWebviewUri(
        vscode.Uri.joinPath(distPath, normalizedAssetPath)
      );
      return `${prefix}${assetUri}"`;
    }
  );

  const theme = vscode.window.activeColorTheme;

  const toSafeInlineScriptJson = (value: unknown): string => {
    const json = JSON.stringify(value);
    return json
      .replace(/<\//g, '<\\/')
      .replace(/<!--/g, '<\\!--')
      // Prevent inline script breakage on some runtimes when content includes line separators
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
  };

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
      scriptContent += `\n    window.planContent = ${toSafeInlineScriptJson(options.planContent)};`;
    }
  }

  if (options.isToolApproval) {
    scriptContent += '\n    window.isToolApproval = true;';
    if (options.approvalData) {
      scriptContent += `\n    window.approvalData = ${toSafeInlineScriptJson(options.approvalData)};`;
    }
  }

  if (options.isMermaidPreview) {
    scriptContent += '\n    window.isMermaidPreview = true;';
    if (options.mermaidCode) {
      scriptContent += `\n    window.mermaidCode = ${toSafeInlineScriptJson(options.mermaidCode)};`;
    }
    if (options.mermaidId) {
      scriptContent += `\n    window.mermaidId = ${toSafeInlineScriptJson(options.mermaidId)};`;
    }
  }

  if (options.workspaceInfo) {
    scriptContent += `\n    window.workspaceContext = ${toSafeInlineScriptJson(options.workspaceInfo)};`;
  }

  // Insert base href (for Vite dynamic imports), CSP, and bootstrap script
  html = html.replace(
    /<head\s*>/gi,
    `<head>
    <base href="${baseUri.toString()}/">
    <script type="importmap">${importMap}</script>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-inline' 'wasm-unsafe-eval'; worker-src blob: data: ${webview.cspSource}; connect-src http: https: ${webview.cspSource} vscode-webview:;">
    <script>${scriptContent}
    </script>`
  );

  return html;
}