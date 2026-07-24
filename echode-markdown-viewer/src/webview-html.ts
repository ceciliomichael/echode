import * as fs from 'fs';
import * as vscode from 'vscode';
import type { MarkdownPreviewDocumentInfo } from './markdown-preview-utils';

export interface WebviewBootstrapState {
  content: string;
  documentUri: string;
  documentBaseUri: string | null;
  title: string;
  docType: string;
}

function escapeInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return nonce;
}

export function generateWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  documentInfo: MarkdownPreviewDocumentInfo,
): string {
  const mediaUri = vscode.Uri.joinPath(extensionUri, 'media');
  const indexUri = vscode.Uri.joinPath(mediaUri, 'index.html');
  let html: string;

  try {
    html = fs.readFileSync(indexUri.fsPath, 'utf8');
  } catch {
    return '<!doctype html><html><body><p>EchoDE Markdown Viewer assets are missing. Rebuild the extension and try again.</p></body></html>';
  }

  const nonce = createNonce();
  const baseUri = webview.asWebviewUri(mediaUri).toString();
  const documentBaseUri = documentInfo.uri.scheme === 'untitled'
    ? null
    : `${webview.asWebviewUri(vscode.Uri.joinPath(documentInfo.uri, '..')).toString()}/`;
  const state: WebviewBootstrapState = {
    content: documentInfo.content,
    documentUri: documentInfo.uri.toString(true),
    documentBaseUri,
    title: documentInfo.title,
    docType: documentInfo.docType,
  };

  html = html.replace(
    /(href|src)="\.\/([^\"]+)"/g,
    (_match, attribute: string, assetPath: string) =>
      `${attribute}="${webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, assetPath))}"`,
  );
  html = html.replace(/<script\s+type="module"/g, `<script nonce="${nonce}" type="module"`);
  html = html.replace(
    /<head>/i,
    `<head>
      <base href="${baseUri}/">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'nonce-${nonce}' 'wasm-unsafe-eval'; worker-src blob: data: ${webview.cspSource};">
      <script nonce="${nonce}">window.__ECHODE_MARKDOWN__=${escapeInlineJson(state)};window.vscode=acquireVsCodeApi();</script>`,
  );

  return html;
}
