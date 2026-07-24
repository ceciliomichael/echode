import * as vscode from 'vscode';
import { MarkdownViewerManager } from './markdown-viewer-manager';

export function activate(context: vscode.ExtensionContext): void {
  const manager = new MarkdownViewerManager(context);
  context.subscriptions.push(
    manager,
    vscode.commands.registerCommand(
      'echodeMarkdownViewer.openPreview',
      (resource?: vscode.Uri) => manager.open(resource, vscode.ViewColumn.Active),
    ),
    vscode.commands.registerCommand(
      'echodeMarkdownViewer.openPreviewToSide',
      (resource?: vscode.Uri) => manager.open(resource, vscode.ViewColumn.Beside),
    ),
    vscode.window.registerWebviewPanelSerializer(MarkdownViewerManager.viewType, {
      deserializeWebviewPanel: (panel, state) => manager.revive(panel, state),
    }),
  );
}

export function deactivate(): void {}
