import * as vscode from 'vscode';
import { generateWebviewHtml, ApprovalData } from '../../utils/html-generator/base-webview';

/**
 * Queued approval request with data and promise resolvers
 */
interface QueuedApproval {
  data: ApprovalData;
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
}

/**
 * Singleton manager for the Tool Approval webview panel.
 * Opens a dedicated panel for Manual Mode approvals with diff viewer.
 * 
 * Supports queue-based approval handling for parallel tool executions:
 * - Multiple approval requests are queued
 * - Processed one at a time in FIFO order
 * - Panel updates to show next item after each response
 */
export class ApprovalViewerManager {
  private static _instance: ApprovalViewerManager | null = null;
  private panel: vscode.WebviewPanel | null = null;
  private context: vscode.ExtensionContext;
  
  /** Queue of pending approval requests */
  private approvalQueue: QueuedApproval[] = [];
  
  /** Currently displayed approval (first in queue) */
  private get currentApproval(): QueuedApproval | undefined {
    return this.approvalQueue[0];
  }

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Initialize the singleton with extension context.
   * Must be called once during extension activation.
   */
  static initialize(context: vscode.ExtensionContext): void {
    if (!ApprovalViewerManager._instance) {
      ApprovalViewerManager._instance = new ApprovalViewerManager(context);
    }
  }

  /**
   * Get the singleton instance.
   * Throws if not initialized.
   */
  static get instance(): ApprovalViewerManager {
    if (!ApprovalViewerManager._instance) {
      throw new Error('ApprovalViewerManager not initialized. Call initialize() first.');
    }
    return ApprovalViewerManager._instance;
  }

  /**
   * Check if manager has been initialized
   */
  static get isInitialized(): boolean {
    return ApprovalViewerManager._instance !== null;
  }

  /**
   * Get the number of pending approvals in the queue
   */
  get queueLength(): number {
    return this.approvalQueue.length;
  }

  /**
   * Request user approval for a tool execution.
   * If other approvals are pending, this request is queued.
   * @returns Promise that resolves to true (approved) or false (rejected)
   */
  async requestApproval(data: ApprovalData): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      const queuedItem: QueuedApproval = {
        data,
        resolve,
        reject,
      };

      // Add to queue
      this.approvalQueue.push(queuedItem);
      console.log(`[ApprovalManager] Queued approval for ${data.toolName}, queue length: ${this.approvalQueue.length}`);

      // If this is the only item in the queue, show it immediately
      if (this.approvalQueue.length === 1) {
        this.showCurrentApproval();
      }
      // Otherwise, it will be shown when previous approvals are processed
    });
  }

  /**
   * Show the current (first) approval in the queue
   */
  private showCurrentApproval(): void {
    const current = this.currentApproval;
    if (!current) {
      // Queue is empty, close panel if open
      if (this.panel) {
        this.panel.dispose();
        this.panel = null;
      }
      return;
    }

    if (this.panel) {
      // Panel exists - update content and reveal
      this.updatePanelContent(current.data);
      this.panel.reveal(vscode.ViewColumn.Active, false);
    } else {
      // Create new panel
      this.createPanel(current.data);
    }
  }

  /**
   * Process the next approval in the queue after current one is handled
   */
  private processNextApproval(): void {
    // Remove the processed item from the front of the queue
    this.approvalQueue.shift();
    
    console.log(`[ApprovalManager] Processing next, remaining queue: ${this.approvalQueue.length}`);

    if (this.approvalQueue.length > 0) {
      // Show next approval
      this.showCurrentApproval();
    } else {
      // Queue empty, close panel
      if (this.panel) {
        this.panel.dispose();
        this.panel = null;
      }
    }
  }

  /**
   * Close the approval panel and reject all pending approvals
   */
  close(): void {
    // Reject all pending approvals
    for (const item of this.approvalQueue) {
      item.resolve(false); // Treat close as rejection for all
    }
    this.approvalQueue = [];

    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }

  /**
   * Handle approval response from webview
   */
  private handleApprovalResponse(approved: boolean, requestId: string): void {
    const current = this.currentApproval;
    
    if (current && current.data.requestId === requestId) {
      // Resolve the current approval
      current.resolve(approved);
      
      // Process next in queue
      this.processNextApproval();
    } else {
      // Request ID doesn't match current - might be stale, ignore
      console.warn(`[ApprovalManager] Received response for unknown requestId: ${requestId}`);
    }
  }

  private createPanel(data: ApprovalData): void {
    this.panel = vscode.window.createWebviewPanel(
      'echode.toolApproval',
      this.getPanelTitle(data),
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
    this.updatePanelContent(data);

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      // Panel closed by user - reject all remaining approvals
      for (const item of this.approvalQueue) {
        item.resolve(false); // Treat close as rejection
      }
      this.approvalQueue = [];
      this.panel = null;
    });

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(message);
    });
  }

  /**
   * Generate panel title with queue indicator
   */
  private getPanelTitle(data: ApprovalData): string {
    const queueIndicator = this.approvalQueue.length > 1 
      ? ` (1/${this.approvalQueue.length})` 
      : '';
    return `Approve: ${data.title}${queueIndicator}`;
  }

  private updatePanelContent(data: ApprovalData): void {
    if (!this.panel) return;

    // Update title with queue position
    this.panel.title = this.getPanelTitle(data);
    
    // Add queue info to approval data for frontend display
    const enrichedData: ApprovalData & { queuePosition?: number; queueTotal?: number } = {
      ...data,
      queuePosition: 1,
      queueTotal: this.approvalQueue.length,
    };

    this.panel.webview.html = generateWebviewHtml(
      this.panel.webview,
      this.context.extensionUri,
      {
        title: `Tool Approval: ${data.title}`,
        isToolApproval: true,
        approvalData: enrichedData,
      }
    );
  }

  private handleWebviewMessage(message: { type: string; requestId?: string }): void {
    switch (message.type) {
      case 'approveTool':
        if (message.requestId) {
          this.handleApprovalResponse(true, message.requestId);
        }
        break;
      case 'rejectTool':
        if (message.requestId) {
          this.handleApprovalResponse(false, message.requestId);
        }
        break;
      case 'rejectAllTools':
        // Reject all pending approvals and close
        this.close();
        break;
      case 'closeApprovalViewer':
        this.close();
        break;
    }
  }
}