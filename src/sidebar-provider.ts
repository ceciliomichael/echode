import * as vscode from 'vscode';
import { handleApiRequest } from './handlers/api-handler';
import { handleChatStream } from './handlers/chat-streaming-handler';
import { handleModelFetch } from './handlers/model-fetching-handler';
import { handleToolExecution, setFileModificationCallback } from './handlers/tool-execution-handler';
import { handleMcpMessage } from './sidebar/handlers/mcp-handler';
import { handleSearchFiles } from './sidebar/handlers/search-handler';
import { getMainWebviewHtml } from './utils/html-generator';
import { ChatHistoryService } from './services/chat-history-service';
import { ToolHistoryService } from './services/tool-history';
import { AutocompleteService } from './autocomplete';
import { WorkspaceManager, PanelManager, createMessageRouter } from './sidebar';
import type { HandlerContext } from './sidebar';

/**
 * Echode Sidebar Provider
 * Main provider for the VSCode webview sidebar
 */
export class EchodeSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'echode.sidebar';
  private _view?: vscode.WebviewView;
  private _historyService: ChatHistoryService;
  private _toolHistoryService: ToolHistoryService;
  private _isHistoryOpen: boolean = false;
  private _autocompleteService: AutocompleteService;
  private _workspaceManager: WorkspaceManager;
  private _panelManager: PanelManager;
  private _messageRouter = createMessageRouter();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
    autocompleteService: AutocompleteService
  ) {
    this._autocompleteService = autocompleteService;
    const workspacePath = this.getCurrentWorkspacePath();
    this._historyService = new ChatHistoryService(_context, workspacePath);
    this._toolHistoryService = new ToolHistoryService();

    // Initialize workspace manager
    this._workspaceManager = new WorkspaceManager(_context.extensionPath);

    // Initialize panel manager with settings saved callback
    this._panelManager = new PanelManager(
      _extensionUri,
      autocompleteService,
      (settings) => {
        if (this._view) {
          this._view.webview.postMessage({ type: 'settingsSaved', settings });
        }
      }
    );

    // Listen for workspace folder changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const newWorkspacePath = this.getCurrentWorkspacePath();
      this._historyService.updateWorkspace(newWorkspacePath);
      this._workspaceManager.setupFileWatcher(() => {
        if (this._view) {
          this._workspaceManager.sendWorkspaceInfo(this._view.webview);
        }
      });
    });

    // When files are modified via write_to_file or apply_diff tools, we want to
    // rescan the workspace for large/refactor-sensitive files.
    setFileModificationCallback(() => {
      this._workspaceManager.resetRefactorScan();
      if (this._view) {
        this._workspaceManager.sendRefactorScanResults(this._view.webview);
      }
    });

    // Setup file watcher for workspace file changes
    this._workspaceManager.setupFileWatcher(() => {
      if (this._view) {
        this._workspaceManager.sendWorkspaceInfo(this._view.webview);
      }
    });
  }

  private getCurrentWorkspacePath(): string | undefined {
    return this._workspaceManager?.getCurrentWorkspacePath()
      ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Trigger new chat in the webview
   */
  public newChat(): void {
    if (this._view) {
      this._view.webview.postMessage({ type: 'newChat' });
    }
  }

  /**
   * Refresh workspace context (called when .gitignore changes)
   */
  public refreshWorkspaceContext(): void {
    if (this._view) {
      this._workspaceManager.sendWorkspaceInfo(this._view.webview);
    }
  }

  /**
   * Toggle chat history modal in main webview
   */
  public openHistoryPanel(): void {
    if (this._view) {
      if (this._isHistoryOpen) {
        this._view.webview.postMessage({ type: 'closeHistory' });
        this._isHistoryOpen = false;
      } else {
        this._view.webview.postMessage({ type: 'openHistory' });
        this._isHistoryOpen = true;
      }
    }
  }

  /**
   * Open settings panel
   */
  public openSettingsPanel(): void {
    this._panelManager.openSettingsPanel();
  }

  /**
   * Resolve webview view
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    // Update history service with current workspace when view is resolved
    const workspacePath = this.getCurrentWorkspacePath();
    this._historyService.updateWorkspace(workspacePath);

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist')
      ]
    };

    webviewView.webview.html = getMainWebviewHtml(webviewView.webview, this._extensionUri);

    // Send initial workspace info and start refactor scan
    this._workspaceManager.sendWorkspaceInfo(webviewView.webview);

    // Create handler context for message router
    const handlerContext: HandlerContext = {
      webview: webviewView,
      historyService: this._historyService,
      toolHistoryService: this._toolHistoryService,
      workspaceManager: this._workspaceManager,
      panelManager: this._panelManager,
      setHistoryOpen: (open: boolean) => { this._isHistoryOpen = open; }
    };

    webviewView.webview.onDidReceiveMessage(async (data) => {
      // Try to route through the message router first
      const handled = await this._messageRouter.route(data, handlerContext);
      if (handled) {
        return;
      }

      // Handle MCP messages
      if (typeof data.type === 'string' && data.type.startsWith('mcp.')) {
        await handleMcpMessage(data, webviewView);
        return;
      }

      // Handle messages not covered by the router (external handlers)
      switch (data.type) {
        case 'apiRequest':
          await handleApiRequest(data, webviewView);
          break;
        case 'chatStream':
        case 'chatStreamAbort':
          await handleChatStream(data, webviewView);
          break;
        case 'fetchModels':
          await handleModelFetch(data, webviewView);
          break;
        case 'executeTool':
        case 'abortToolExecution':
          await handleToolExecution(data, webviewView);
          break;
        case 'searchFiles':
          await handleSearchFiles(data, webviewView);
          break;
      }
    });
  }
}