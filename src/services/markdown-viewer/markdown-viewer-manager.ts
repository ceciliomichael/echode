import * as vscode from 'vscode';
import { generateWebviewHtml } from '../../utils/html-generator/base-webview';
import {
  buildMarkdownPreviewDocumentInfo,
  type MarkdownPreviewDocumentInfo,
} from './markdown-preview-utils';

/**
 * Singleton manager for markdown preview webview panels.
 * Opens markdown files in custom tabs with full Mermaid support.
 */
export class MarkdownViewerManager {
  private static _instance: MarkdownViewerManager | null = null;
  private readonly panels = new Map<string, vscode.WebviewPanel>();
  private readonly panelState = new Map<string, MarkdownPreviewDocumentInfo>();
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Listen for text document changes to provide live preview updates
    vscode.workspace.onDidChangeTextDocument((e) => {
      this.handleDocumentChange(e.document);
    });
  }

  private handleDocumentChange(document: vscode.TextDocument): void {
    if (document.languageId !== 'markdown' && !document.fileName.toLowerCase().endsWith('.md')) {
      return;
    }
    
    const filePath = document.uri.scheme === 'file' ? document.uri.fsPath : undefined;
    const panelKey = filePath ? filePath.replace(/\\/g, '/').toLowerCase() : document.uri.toString();
    
    const panel = this.panels.get(panelKey);
    if (panel) {
      const content = document.getText();
      const documentInfo = this.panelState.get(panelKey);
      if (documentInfo && documentInfo.content !== content) {
        // Update stored state
        this.panelState.set(panelKey, { ...documentInfo, content });
        // Send message to update content without reloading the webview
        panel.webview.postMessage({
          type: 'updatePlanContent',
          content: content
        });
      }
    }
  }

  /**
   * Initialize the singleton with extension context.
   * Must be called once during extension activation.
   */
  static initialize(context: vscode.ExtensionContext): void {
    if (!MarkdownViewerManager._instance) {
      MarkdownViewerManager._instance = new MarkdownViewerManager(context);
    }
  }

  /**
   * Get the singleton instance.
   * Throws if not initialized.
   */
  static get instance(): MarkdownViewerManager {
    if (!MarkdownViewerManager._instance) {
      throw new Error('MarkdownViewerManager not initialized. Call initialize() first.');
    }
    return MarkdownViewerManager._instance;
  }

  /**
   * Check if manager has been initialized
   */
  static get isInitialized(): boolean {
    return MarkdownViewerManager._instance !== null;
  }

  /**
   * Open a markdown document in the custom viewer.
   * Creates a new tab per file and reuses the existing tab for the same file.
   */
  openDocument(title: string, content: string, filePath?: string, docType: string = 'Document'): void {
    const documentInfo: MarkdownPreviewDocumentInfo = {
      filePath,
      panelKey: filePath?.replace(/\\/g, '/').toLowerCase() ?? title,
      title,
      docType,
      content,
    };

    this.openDocumentInfo(documentInfo);
  }

  /**
   * Open a markdown TextDocument in the custom viewer.
   */
  openTextDocument(document: vscode.TextDocument): void {
    this.openDocumentInfo(buildMarkdownPreviewDocumentInfo(document));
  }

  /**
   * Close the markdown viewer panel if open
   */
  close(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
    this.panelState.clear();
  }

  /**
   * Get the current document file path
   */
  getCurrentDocumentPath(): string | undefined {
    return this.context.workspaceState.get<string>('echode.currentDocumentPath');
  }

  private openDocumentInfo(documentInfo: MarkdownPreviewDocumentInfo): void {
    if (documentInfo.filePath) {
      this.context.workspaceState.update('echode.currentDocumentPath', documentInfo.filePath);
    }

    const existingPanel = this.panels.get(documentInfo.panelKey);
    if (existingPanel) {
      const currentState = this.panelState.get(documentInfo.panelKey);
      if (
        currentState &&
        currentState.title === documentInfo.title &&
        currentState.docType === documentInfo.docType &&
        currentState.content === documentInfo.content
      ) {
        existingPanel.reveal(vscode.ViewColumn.Active, false);
        return;
      }

      this.updatePanelContent(existingPanel, documentInfo);
      existingPanel.reveal(vscode.ViewColumn.Active, false);
      return;
    }

    this.createPanel(documentInfo);
  }

  private createPanel(documentInfo: MarkdownPreviewDocumentInfo): void {
    const panel = vscode.window.createWebviewPanel(
      'echode.markdownViewer',
      documentInfo.title,
      {
        viewColumn: vscode.ViewColumn.Active,
        preserveFocus: false,
      },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'dist'),
        ],
      }
    );

    panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'icon.svg');
    this.panels.set(documentInfo.panelKey, panel);
    this.panelState.set(documentInfo.panelKey, documentInfo);

    // Set initial HTML content
    this.updatePanelContent(panel, documentInfo);

    // Handle panel disposal
    panel.onDidDispose(() => {
      this.panels.delete(documentInfo.panelKey);
      this.panelState.delete(documentInfo.panelKey);
    });

    // Handle messages from webview (if needed in future)
    panel.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(documentInfo.panelKey, message);
    });
  }

  private updatePanelContent(panel: vscode.WebviewPanel, documentInfo: MarkdownPreviewDocumentInfo): void {
    panel.title = `${documentInfo.docType}: ${documentInfo.title}`;
    this.panelState.set(documentInfo.panelKey, documentInfo);
    panel.webview.html = generateWebviewHtml(
      panel.webview,
      this.context.extensionUri,
      {
        title: `${documentInfo.docType}: ${documentInfo.title}`,
        isPlanViewer: true,
        planContent: documentInfo.content,
      }
    );
  }

  private async handleWebviewMessage(panelKey: string, message: any): Promise<void> {
    switch (message.type) {
      case 'closeMarkdownViewer':
        this.panels.get(panelKey)?.dispose();
        break;
      case 'openRelativeLink':
      case 'openMarkdownLink':
        if (message.href) {
          const docInfo = this.panelState.get(panelKey);
          if (docInfo && docInfo.filePath) {
            try {
              // Parse the href to separate the file path from any hash fragment
              const [linkPath, fragment] = message.href.split('#');
              const docUri = vscode.Uri.file(docInfo.filePath);
              const dirUri = vscode.Uri.joinPath(docUri, '..');
              const targetUri = vscode.Uri.joinPath(dirUri, linkPath);
              
              if (targetUri.fsPath.toLowerCase().endsWith('.md')) {
                // Open the document in the markdown viewer
                const document = await vscode.workspace.openTextDocument(targetUri);
                this.openTextDocument(document);
              } else {
                // For non-markdown files (like images, ts files, etc) let VS Code handle it normally
                await vscode.commands.executeCommand('vscode.open', targetUri);
              }
            } catch (err) {
              vscode.window.showErrorMessage(`Failed to open link: ${message.href}`);
            }
          } else {
            // If we don't have a file path, we can't resolve relative links
            vscode.window.showWarningMessage('Cannot open relative link: Current document has no file path.');
          }
        }
        break;
    }
  }
}
