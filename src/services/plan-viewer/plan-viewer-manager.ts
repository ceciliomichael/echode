import * as vscode from 'vscode';
import { generateWebviewHtml } from '../../utils/html-generator/base-webview';

/**
 * Singleton manager for the Plan Viewer webview panel.
 * Opens plans in a custom webview with the same rendering as AI responses.
 */
export class PlanViewerManager {
  private static _instance: PlanViewerManager | null = null;
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
    if (!PlanViewerManager._instance) {
      PlanViewerManager._instance = new PlanViewerManager(context);
    }
  }

  /**
   * Get the singleton instance.
   * Throws if not initialized.
   */
  static get instance(): PlanViewerManager {
    if (!PlanViewerManager._instance) {
      throw new Error('PlanViewerManager not initialized. Call initialize() first.');
    }
    return PlanViewerManager._instance;
  }

  /**
   * Check if manager has been initialized
   */
  static get isInitialized(): boolean {
    return PlanViewerManager._instance !== null;
  }

  /**
   * Open a plan in the custom viewer.
   * Creates a new panel or reveals/updates the existing one.
   */
  openPlan(title: string, content: string, filePath?: string): void {
    if (filePath) {
      this.context.workspaceState.update('echode.currentPlanPath', filePath);
    }

    if (this.panel) {
      // Panel exists - update content and reveal
      this.updatePanelContent(title, content);
      this.panel.reveal(vscode.ViewColumn.Active, false);
    } else {
      // Create new panel
      this.createPanel(title, content);
    }
  }

  /**
   * Close the plan viewer panel if open
   */
  close(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
      // We purposefully don't clear the workspace state path on close,
      // so it remembers the last active plan even if the viewer is closed.
    }
  }

  /**
   * Get the current plan file path
   */
  getCurrentPlanPath(): string | undefined {
    return this.context.workspaceState.get<string>('echode.currentPlanPath');
  }

  private createPanel(title: string, content: string): void {
    this.panel = vscode.window.createWebviewPanel(
      'echode.planViewer',
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
    this.updatePanelContent(title, content);

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      this.panel = null;
    });

    // Handle messages from webview (if needed in future)
    this.panel.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(message);
    });
  }

  private updatePanelContent(title: string, content: string): void {
    if (!this.panel) return;

    this.panel.title = `${title}`;
    this.panel.webview.html = generateWebviewHtml(
      this.panel.webview,
      this.context.extensionUri,
      {
        title: `Plan: ${title}`,
        isPlanViewer: true,
        planContent: content,
      }
    );
  }

  private handleWebviewMessage(message: { type: string }): void {
    switch (message.type) {
      case 'closePlanViewer':
        this.close();
        break;
      // Add more message handlers as needed
    }
  }
}