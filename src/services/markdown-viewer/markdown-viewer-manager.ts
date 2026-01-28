import * as vscode from 'vscode';
import { generateWebviewHtml } from '../../utils/html-generator/base-webview';

/**
 * Singleton manager for the Markdown Viewer webview panel.
 * Opens markdown files in a custom webview with full mermaid diagram support.
 * Works with all .md files, not just plan/review files.
 */
export class MarkdownViewerManager {
  private static _instance: MarkdownViewerManager | null = null;
  private panel: vscode.WebviewPanel | null = null;
  private context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
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
   * Creates a new panel or reveals/updates the existing one.
   * @param title - The display title for the document
   * @param content - The markdown content to display
   * @param filePath - Optional file path for workspace state tracking
   * @param docType - The document type label (defaults to 'Document')
   */
  openDocument(title: string, content: string, filePath?: string, docType: string = 'Document'): void {
    if (filePath) {
      this.context.workspaceState.update('echode.currentDocumentPath', filePath);
    }

    if (this.panel) {
      // Panel exists - update content and reveal
      this.updatePanelContent(title, content, docType);
      this.panel.reveal(vscode.ViewColumn.Active, false);
    } else {
      // Create new panel
      this.createPanel(title, content, docType);
    }
  }

  /**
   * Close the markdown viewer panel if open
   */
  close(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }

  /**
   * Get the current document file path
   */
  getCurrentDocumentPath(): string | undefined {
    return this.context.workspaceState.get<string>('echode.currentDocumentPath');
  }

  private createPanel(title: string, content: string, docType: string = 'Document'): void {
    this.panel = vscode.window.createWebviewPanel(
      'echode.markdownViewer',
      `${title}`,
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

    // Set initial HTML content
    this.updatePanelContent(title, content, docType);

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      this.panel = null;
    });

    // Handle messages from webview (if needed in future)
    this.panel.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(message);
    });
  }

  private updatePanelContent(title: string, content: string, docType: string = 'Document'): void {
    if (!this.panel) {
      return;
    }

    this.panel.title = `${title}`;
    this.panel.webview.html = generateWebviewHtml(
      this.panel.webview,
      this.context.extensionUri,
      {
        title: `${docType}: ${title}`,
        isPlanViewer: true,
        planContent: content,
      }
    );
  }

  private handleWebviewMessage(message: { type: string }): void {
    switch (message.type) {
      case 'closeMarkdownViewer':
        this.close();
        break;
    }
  }
}