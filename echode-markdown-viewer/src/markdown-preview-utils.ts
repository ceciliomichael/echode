import * as path from 'path';
import * as vscode from 'vscode';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

export interface MarkdownPreviewDocumentInfo {
  readonly uri: vscode.Uri;
  readonly panelKey: string;
  readonly title: string;
  readonly docType: string;
  readonly content: string;
}

export function isMarkdownUri(uri: vscode.Uri): boolean {
  return MARKDOWN_EXTENSIONS.has(path.extname(uri.path).toLowerCase());
}

export function isMarkdownPreviewableDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'markdown' || isMarkdownUri(document.uri);
}

function inferTitle(document: vscode.TextDocument): string {
  const firstHeading = document.getText().match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
  return firstHeading || path.basename(document.uri.path) || document.fileName || 'Untitled';
}

function inferDocumentType(normalizedUri: string): string {
  if (normalizedUri.includes('/.echode/plan/')) {
    return 'Plan';
  }
  if (normalizedUri.includes('/.echode/codereview/')) {
    return 'Review';
  }
  return 'Markdown';
}

export function buildMarkdownPreviewDocumentInfo(
  document: vscode.TextDocument,
): MarkdownPreviewDocumentInfo {
  const panelKey = document.uri.toString(true);
  const normalizedUri = panelKey.replace(/\\/g, '/').toLowerCase();

  return {
    uri: document.uri,
    panelKey,
    title: inferTitle(document),
    docType: inferDocumentType(normalizedUri),
    content: document.getText(),
  };
}
