import * as vscode from 'vscode';
import { MarkdownViewerManager } from './services/markdown-viewer/markdown-viewer-manager';
import { isMarkdownPreviewableDocument } from './services/markdown-viewer/markdown-preview-utils';

export function activate(context: vscode.ExtensionContext) {
  // Initialize Markdown Viewer Manager (for all .md files with mermaid support)
  MarkdownViewerManager.initialize(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('markdown-viewer.openPreview', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('Open a markdown file first to preview it.');
        return;
      }

      const document = editor.document;
      if (!isMarkdownPreviewableDocument(document)) {
        vscode.window.showInformationMessage('Markdown preview is only available for markdown files.');
        return;
      }

      // Use custom markdown viewer for markdown files
      if (MarkdownViewerManager.isInitialized) {
        MarkdownViewerManager.instance.openTextDocument(document);
      } else {
        await vscode.commands.executeCommand('markdown.showPreview', document.uri);
      }
    })
  );
}

export function deactivate() {
  if (MarkdownViewerManager.isInitialized) {
    MarkdownViewerManager.instance.close();
  }
}
