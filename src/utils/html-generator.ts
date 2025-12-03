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

/**
 * Generate HTML for Mermaid preview panel
 */
export function getMermaidPreviewHtml(
  webview: vscode.Webview,
  code: string
): string {
  const theme = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'default';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} https://cdn.jsdelivr.net 'unsafe-inline';">
  <title>Mermaid Preview</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: var(--vscode-font-family), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #toolbar {
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--vscode-input-border);
      background: var(--vscode-editor-background);
      flex-shrink: 0;
    }
    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 2px;
      background: transparent;
      border: 1px solid var(--vscode-input-border);
      border-radius: 12px;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .toolbar-group:hover {
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
    }
    .toolbar-divider {
      width: 1px;
      height: 20px;
      background: var(--vscode-input-border);
    }
    button {
      background: transparent;
      color: var(--vscode-foreground);
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 400;
      transition: background 0.1s ease;
      outline: none !important;
      box-shadow: none !important;
    }
    button:hover {
      background: transparent;
    }
    button:active {
      background: transparent;
    }
    button:hover .icon {
      transform: scale(1.05);
    }
    button:active .icon {
      transform: scale(0.95);
    }
    button:focus {
      outline: none !important;
      box-shadow: none !important;
    }
    .save-group {
      display: flex;
      align-items: center;
      padding: 2px;
      background: transparent;
      border: 1px solid var(--vscode-input-border); 
      border-radius: 12px;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .save-group:hover {
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
    }
    .save-group button {
      color: var(--vscode-foreground);
      transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .save-group button:hover {
      background: transparent;
      transform: scale(1.03);
    }
    .save-group button:active {
      transform: scale(0.98);
    }
    .button-divider {
      width: 1px;
      height: 14px;
      background: var(--vscode-input-border);
      margin: 0 2px;
    }
    .save-svg-group {
      display: flex;
      align-items: center;
      padding: 2px;
      background: transparent;
      border: 1px solid var(--vscode-input-border); 
      border-radius: 12px;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .save-svg-group:hover {
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.05);
    }
    .save-svg-group button {
      color: var(--vscode-foreground);
    }
    .save-svg-group button:hover {
      background: transparent;
    }
    #zoom-level {
      font-size: 11px;
      color: var(--vscode-foreground);
      min-width: 40px;
      text-align: center;
      font-weight: 500;
    }
    #container {
      flex: 1;
      overflow: hidden;
      position: relative;
      cursor: grab;
      background: var(--vscode-editor-background);
      user-select: none;
      -webkit-user-select: none;
    }
    #container.panning {
      cursor: grabbing;
    }
    #container * {
      user-select: none;
      -webkit-user-select: none;
    }
    #diagram-wrapper {
      position: absolute;
      left: 50%;
      top: 50%;
      transform-origin: center center;
      transition: transform 0.08s ease-out;
    }
    #footer {
      padding: 8px 16px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      border-top: 1px solid var(--vscode-input-border);
      background: var(--vscode-editor-background);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #footer::before {
      content: '';
      width: 6px;
      height: 6px;
      background: var(--vscode-button-background);
      border-radius: 50%;
      opacity: 0.7;
    }
    /* Icon styling */
    .icon {
      width: 14px;
      height: 14px;
      stroke-width: 2;
      transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <div class="toolbar-group">
      <button onclick="zoomOut()" title="Zoom Out">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14"/></svg>
      </button>
      <span id="zoom-level">100%</span>
      <button onclick="zoomIn()" title="Zoom In">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>
    <div class="save-group">
      <button onclick="resetView()" title="Reset View">Reset</button>
      <span class="button-divider"></span>
      <button onclick="fitToView()" title="Fit to View">Fit</button>
    </div>
    <div style="flex: 1;"></div>
    <div class="save-svg-group">
      <button onclick="saveSvg()" title="Save as SVG">Save SVG</button>
    </div>
  </div>
  <div id="container">
    <div id="diagram-wrapper">
      <div class="mermaid">
${code}
      </div>
    </div>
  </div>
  <div id="footer">Scroll to zoom • Drag to pan • Double-click to reset</div>
  <script>
    const vscode = acquireVsCodeApi();
    mermaid.initialize({
      startOnLoad: true,
      theme: '${theme}',
      securityLevel: 'loose',
    });

    // Pan/Zoom state
    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startX = 0;
    let startY = 0;

    const container = document.getElementById('container');
    const wrapper = document.getElementById('diagram-wrapper');
    const zoomLabel = document.getElementById('zoom-level');

    function updateTransform() {
      wrapper.style.transform = 'translate(-50%, -50%) translate(' + panX + 'px, ' + panY + 'px) scale(' + scale + ')';
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }

    function zoomIn() {
      scale = Math.min(5, scale + 0.2);
      updateTransform();
    }

    function zoomOut() {
      scale = Math.max(0.1, scale - 0.2);
      updateTransform();
    }

    function resetView() {
      scale = 1;
      panX = 0;
      panY = 0;
      updateTransform();
    }

    function fitToView() {
      const svg = container.querySelector('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scaleX = (containerRect.width - 40) / rect.width * scale;
      const scaleY = (containerRect.height - 40) / rect.height * scale;
      scale = Math.min(scaleX, scaleY, 2);
      panX = 0;
      panY = 0;
      updateTransform();
    }

    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      scale = Math.max(0.1, Math.min(5, scale + delta));
      updateTransform();
    });

    // Pan with mouse drag
    container.addEventListener('mousedown', (e) => {
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      container.classList.add('panning');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
      container.classList.remove('panning');
    });

    // Double-click to reset
    container.addEventListener('dblclick', resetView);

    function saveSvg() {
      const svg = container.querySelector('svg');
      if (svg) {
        vscode.postMessage({
          type: 'saveMermaidSvg',
          svg: svg.outerHTML
        });
      }
    }

    // Initial auto-fit after render
    setTimeout(() => {
      fitToView();
      // Notify extension that preview is ready
      vscode.postMessage({ type: 'mermaidPreviewReady' });
    }, 500);

    // Listen for close event
    window.addEventListener('beforeunload', () => {
      vscode.postMessage({ type: 'mermaidPreviewClosed' });
    });
  </script>
</body>
</html>`;
}

