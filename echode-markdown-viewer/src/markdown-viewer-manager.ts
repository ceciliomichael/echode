import * as path from 'path';
import * as vscode from 'vscode';
import {
  buildMarkdownPreviewDocumentInfo,
  isMarkdownPreviewableDocument,
  isMarkdownUri,
  type MarkdownPreviewDocumentInfo,
} from './markdown-preview-utils';
import { generateWebviewHtml } from './webview-html';

interface PreviewEntry {
  readonly panel: vscode.WebviewPanel;
  documentInfo: MarkdownPreviewDocumentInfo;
}

interface PreviewMessage {
  readonly type?: unknown;
  readonly href?: unknown;
}

export class MarkdownViewerManager implements vscode.Disposable {
  static readonly viewType = 'echodeMarkdownViewer.preview';

  private readonly previews = new Map<string, PreviewEntry>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(({ document }) => this.handleDocumentChange(document)),
      vscode.window.onDidChangeActiveColorTheme(() => this.refreshMermaidThemes()),
    );
  }

  async open(resource: vscode.Uri | undefined, viewColumn: vscode.ViewColumn): Promise<void> {
    const document = await this.resolveDocument(resource);
    if (!document) {
      return;
    }

    if (!isMarkdownPreviewableDocument(document)) {
      void vscode.window.showInformationMessage('Markdown preview is only available for .md and .markdown files.');
      return;
    }

    const documentInfo = buildMarkdownPreviewDocumentInfo(document);
    const existing = this.previews.get(documentInfo.panelKey);
    if (existing) {
      existing.panel.reveal(viewColumn, false);
      this.updateEntry(existing, documentInfo);
      return;
    }

    this.createPanel(documentInfo, viewColumn);
  }

  async revive(panel: vscode.WebviewPanel, state: unknown): Promise<void> {
    const documentUri = this.readDocumentUri(state);
    if (!documentUri) {
      panel.dispose();
      return;
    }

    try {
      const document = await vscode.workspace.openTextDocument(documentUri);
      if (!isMarkdownPreviewableDocument(document)) {
        panel.dispose();
        return;
      }
      this.attachPanel(panel, buildMarkdownPreviewDocumentInfo(document));
    } catch {
      panel.dispose();
      void vscode.window.showWarningMessage('The Markdown document for this preview is no longer available.');
    }
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    for (const { panel } of this.previews.values()) {
      panel.dispose();
    }
    this.previews.clear();
  }

  private async resolveDocument(resource: vscode.Uri | undefined): Promise<vscode.TextDocument | undefined> {
    if (resource) {
      try {
        return await vscode.workspace.openTextDocument(resource);
      } catch {
        void vscode.window.showErrorMessage(`Unable to open ${resource.fsPath || resource.path}.`);
        return undefined;
      }
    }

    const activeDocument = vscode.window.activeTextEditor?.document;
    if (!activeDocument) {
      void vscode.window.showInformationMessage('Open a Markdown file first to preview it.');
    }
    return activeDocument;
  }

  private createPanel(documentInfo: MarkdownPreviewDocumentInfo, viewColumn: vscode.ViewColumn): void {
    const localResourceRoots = [vscode.Uri.joinPath(this.context.extensionUri, 'media')];
    if (documentInfo.uri.scheme !== 'untitled') {
      localResourceRoots.push(vscode.Uri.joinPath(documentInfo.uri, '..'));
    }
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      localResourceRoots.push(folder.uri);
    }

    const panel = vscode.window.createWebviewPanel(
      MarkdownViewerManager.viewType,
      this.getPanelTitle(documentInfo),
      { viewColumn, preserveFocus: viewColumn === vscode.ViewColumn.Beside },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots,
      },
    );

    this.attachPanel(panel, documentInfo);
  }

  private attachPanel(panel: vscode.WebviewPanel, documentInfo: MarkdownPreviewDocumentInfo): void {
    const duplicate = this.previews.get(documentInfo.panelKey);
    if (duplicate && duplicate.panel !== panel) {
      duplicate.panel.dispose();
    }

    const entry: PreviewEntry = { panel, documentInfo };
    this.previews.set(documentInfo.panelKey, entry);
    panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'icon.svg');
    panel.title = this.getPanelTitle(documentInfo);
    panel.webview.html = generateWebviewHtml(panel.webview, this.context.extensionUri, documentInfo);

    panel.onDidDispose(() => {
      if (this.previews.get(documentInfo.panelKey)?.panel === panel) {
        this.previews.delete(documentInfo.panelKey);
      }
    });
    panel.webview.onDidReceiveMessage((message: PreviewMessage) => {
      void this.handleMessage(entry, message);
    });
  }

  private updateEntry(entry: PreviewEntry, nextInfo: MarkdownPreviewDocumentInfo): void {
    const contentChanged = entry.documentInfo.content !== nextInfo.content;
    const titleChanged = entry.documentInfo.title !== nextInfo.title || entry.documentInfo.docType !== nextInfo.docType;
    entry.documentInfo = nextInfo;

    if (titleChanged) {
      entry.panel.title = this.getPanelTitle(nextInfo);
    }
    if (contentChanged) {
      void entry.panel.webview.postMessage({ type: 'updateContent', content: nextInfo.content });
    }
  }

  private handleDocumentChange(document: vscode.TextDocument): void {
    if (!isMarkdownPreviewableDocument(document)) {
      return;
    }
    const entry = this.previews.get(document.uri.toString(true));
    if (entry) {
      this.updateEntry(entry, buildMarkdownPreviewDocumentInfo(document));
    }
  }

  private refreshMermaidThemes(): void {
    for (const { panel } of this.previews.values()) {
      void panel.webview.postMessage({ type: 'themeChanged' });
    }
  }

  private async handleMessage(entry: PreviewEntry, message: PreviewMessage): Promise<void> {
    if (message.type !== 'openLink' || typeof message.href !== 'string') {
      return;
    }

    const href = message.href.trim();
    if (!href || href.startsWith('#')) {
      return;
    }

    if (/^(https?:|mailto:)/i.test(href)) {
      await vscode.env.openExternal(vscode.Uri.parse(href));
      return;
    }

    const targetUri = this.resolveRelativeUri(entry.documentInfo.uri, href);
    if (!targetUri) {
      void vscode.window.showWarningMessage('Relative links are unavailable for untitled Markdown documents.');
      return;
    }

    try {
      if (isMarkdownUri(targetUri)) {
        await this.open(targetUri, vscode.ViewColumn.Active);
      } else {
        await vscode.commands.executeCommand('vscode.open', targetUri);
      }
    } catch {
      void vscode.window.showErrorMessage(`Unable to open link: ${href}`);
    }
  }

  private resolveRelativeUri(documentUri: vscode.Uri, href: string): vscode.Uri | undefined {
    if (documentUri.scheme === 'untitled') {
      return undefined;
    }

    const withoutFragment = href.split('#', 1)[0].split('?', 1)[0];
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(withoutFragment);
    } catch {
      decodedPath = withoutFragment;
    }

    if (documentUri.scheme === 'file') {
      return vscode.Uri.file(path.resolve(path.dirname(documentUri.fsPath), decodedPath));
    }
    return vscode.Uri.joinPath(documentUri, '..', decodedPath);
  }

  private readDocumentUri(state: unknown): vscode.Uri | undefined {
    if (!state || typeof state !== 'object' || !('documentUri' in state)) {
      return undefined;
    }
    const documentUri = (state as { documentUri?: unknown }).documentUri;
    if (typeof documentUri !== 'string') {
      return undefined;
    }
    try {
      return vscode.Uri.parse(documentUri, true);
    } catch {
      return undefined;
    }
  }

  private getPanelTitle(documentInfo: MarkdownPreviewDocumentInfo): string {
    return `${documentInfo.docType}: ${documentInfo.title}`;
  }
}
