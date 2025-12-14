import * as vscode from 'vscode';
import { getMermaidStyles } from './styles';
import { getMermaidScripts } from './scripts';

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
  <style>${getMermaidStyles()}</style>
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
  <script>${getMermaidScripts(theme)}</script>
</body>
</html>`;
}