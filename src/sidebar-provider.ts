import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class EchodeSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'echode.sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public openSettingsPanel() {
    const panel = vscode.window.createWebviewPanel(
      'echodeSettings',
      'Echode Settings',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist')
        ]
      }
    );

    panel.webview.html = this._getSettingsHtml(panel.webview);

    panel.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'saveSettings':
          if (this._view) {
            this._view.webview.postMessage({ type: 'settingsSaved', settings: data.settings });
          }
          break;
        case 'closeSettings':
          panel.dispose();
          break;
        case 'apiRequest':
          this._handleApiRequestForPanel(data, panel);
          break;
      }
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist')
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'info':
          vscode.window.showInformationMessage(data.message);
          break;
        case 'error':
          vscode.window.showErrorMessage(data.message);
          break;
        case 'apiRequest':
          this._handleApiRequest(data, webviewView);
          break;
      }
    });
  }

  private async _handleApiRequest(data: unknown, webviewView: vscode.WebviewView) {
    const { requestId, url, options } = data as {
      requestId: number;
      url: string;
      options: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      };
    };
    
    try {
      const urlObj = new URL(url);

      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? await import('https') : await import('http');

      const requestOptions: {
        hostname: string;
        port: number;
        path: string;
        method: string;
        headers: Record<string, string>;
      } = {
        hostname: urlObj.hostname,
        port: urlObj.port ? Number(urlObj.port) : (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = httpModule.request(requestOptions, (res: any) => {
        let responseData = '';
        
        res.on('data', (chunk: Buffer) => {
          const textChunk = chunk.toString();
          responseData += textChunk;
          webviewView.webview.postMessage({
            type: 'apiStreamChunk',
            requestId,
            chunk: textChunk
          });
        });

        res.on('end', () => {
          webviewView.webview.postMessage({
            type: 'apiResponse',
            requestId,
            status: res.statusCode,
            statusText: res.statusMessage,
            data: responseData
          });
        });
      });

      req.on('error', (error: Error) => {
        webviewView.webview.postMessage({
          type: 'apiError',
          requestId,
          error: error.message
        });
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    } catch (error) {
      webviewView.webview.postMessage({
        type: 'apiError',
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async _handleApiRequestForPanel(data: unknown, panel: vscode.WebviewPanel) {
    const { requestId, url, options } = data as {
      requestId: number;
      url: string;
      options: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      };
    };
    
    try {
      const urlObj = new URL(url);

      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? await import('https') : await import('http');

      const requestOptions: {
        hostname: string;
        port: number;
        path: string;
        method: string;
        headers: Record<string, string>;
      } = {
        hostname: urlObj.hostname,
        port: urlObj.port ? Number(urlObj.port) : (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = httpModule.request(requestOptions, (res: any) => {
        let responseData = '';
        
        res.on('data', (chunk: Buffer) => {
          const textChunk = chunk.toString();
          responseData += textChunk;
          panel.webview.postMessage({
            type: 'apiStreamChunk',
            requestId,
            chunk: textChunk
          });
        });

        res.on('end', () => {
          panel.webview.postMessage({
            type: 'apiResponse',
            requestId,
            status: res.statusCode,
            statusText: res.statusMessage,
            data: responseData
          });
        });
      });

      req.on('error', (error: Error) => {
        panel.webview.postMessage({
          type: 'apiError',
          requestId,
          error: error.message
        });
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    } catch (error) {
      panel.webview.postMessage({
        type: 'apiError',
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private _getSettingsHtml(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist');
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
  <title>Echode Settings</title>
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

    html = html.replace(
      '<head>',
      `<head>
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} 'unsafe-inline'; connect-src http: https:;">
      <script>
        window.vscode = acquireVsCodeApi();
        window.vsCodeTheme = {
          kind: ${theme.kind}
        };
        window.isSettingsPanel = true;
      </script>`
    );

    return html;
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist');
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
  <title>Echode</title>
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
    const colors = {
      background: new vscode.ThemeColor('editor.background'),
      foreground: new vscode.ThemeColor('editor.foreground'),
      inputBackground: new vscode.ThemeColor('input.background'),
      inputForeground: new vscode.ThemeColor('input.foreground'),
      inputBorder: new vscode.ThemeColor('input.border'),
      buttonBackground: new vscode.ThemeColor('button.background'),
      buttonForeground: new vscode.ThemeColor('button.foreground'),
      buttonHoverBackground: new vscode.ThemeColor('button.hoverBackground'),
      badgeBackground: new vscode.ThemeColor('badge.background'),
      badgeForeground: new vscode.ThemeColor('badge.foreground'),
      listHoverBackground: new vscode.ThemeColor('list.hoverBackground'),
      sideBarBackground: new vscode.ThemeColor('sideBar.background'),
      sideBarForeground: new vscode.ThemeColor('sideBar.foreground'),
    };

    html = html.replace(
      '<head>',
      `<head>
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} 'unsafe-inline'; connect-src http: https:;">
      <script>
        window.vscode = acquireVsCodeApi();
        window.vsCodeTheme = {
          kind: ${theme.kind}
        };
      </script>`
    );

    return html;
  }
}