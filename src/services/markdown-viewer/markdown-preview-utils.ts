import * as path from 'path';
import * as vscode from 'vscode';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);

export interface MarkdownPreviewDocumentInfo {
  readonly filePath?: string;
  readonly panelKey: string;
  readonly title: string;
  readonly docType: string;
  readonly content: string;
}

function normalizePathForKey(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase();
}

function isMarkdownExtension(filePath: string): boolean {
  return MARKDOWN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isMarkdownPreviewableDocument(document: vscode.TextDocument): boolean {
  if (document.languageId === 'markdown') {
    return true;
  }

  return document.uri.scheme === 'file' && isMarkdownExtension(document.uri.fsPath);
}

function inferMarkdownPreviewTitle(document: vscode.TextDocument, filePath?: string): string {
  const content = document.getText();
  const firstLine = content.split(/\r?\n/, 1)[0]?.trim() ?? '';

  if (firstLine.startsWith('#')) {
    const heading = firstLine.replace(/^#+\s*/, '').trim();
    if (heading) {
      return heading;
    }
  }

  return filePath ? path.basename(filePath) : document.fileName || 'Untitled';
}

function inferMarkdownPreviewType(normalizedPath: string): string {
  if (normalizedPath.includes('/.echode/plan/')) {
    return 'Plan';
  }

  if (normalizedPath.includes('/.echode/codereview/')) {
    return 'Review';
  }

  return 'Markdown';
}

export function buildMarkdownPreviewDocumentInfo(document: vscode.TextDocument): MarkdownPreviewDocumentInfo {
  const filePath = document.uri.scheme === 'file' ? document.uri.fsPath : undefined;
  const panelKey = filePath ? normalizePathForKey(filePath) : document.uri.toString();

  return {
    filePath,
    panelKey,
    title: inferMarkdownPreviewTitle(document, filePath),
    docType: inferMarkdownPreviewType(panelKey),
    content: document.getText(),
  };
}
