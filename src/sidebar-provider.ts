import * as vscode from 'vscode';
import { handleApiRequest } from './handlers/api-handler';
import { handleChatStream } from './handlers/chat-streaming-handler';
import { handleModelFetch } from './handlers/model-fetching-handler';
import { handleToolExecution } from './handlers/tool-execution-handler';
import { getMainWebviewHtml, getSettingsHtml } from './utils/html-generator';
import { getWorkspaceFiles, getAgentsConfig } from './utils/workspace-scanner';
import { ChatHistoryService } from './services/chat-history-service';
import { ToolHistoryService } from './services/tool-history-service';
import { DiagnosticsService } from './services/diagnostics-service';
import type { ToolExecutionState } from './types/tool-execution';

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

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {
    const workspacePath = this.getCurrentWorkspacePath();
    this._historyService = new ChatHistoryService(_context, workspacePath);
    this._toolHistoryService = new ToolHistoryService();
    
    // Listen for workspace folder changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const newWorkspacePath = this.getCurrentWorkspacePath();
      this._historyService.updateWorkspace(newWorkspacePath);
    });
  }

  private getCurrentWorkspacePath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : undefined;
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
   * Send current workspace info to webview
   */
  private sendWorkspaceInfo(webviewView: vscode.WebviewView): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceInfo = workspaceFolders && workspaceFolders.length > 0
      ? {
          path: workspaceFolders[0].uri.fsPath,
          name: workspaceFolders[0].name,
          files: getWorkspaceFiles(workspaceFolders[0].uri.fsPath),
          agentsConfig: getAgentsConfig(workspaceFolders[0].uri.fsPath)
        }
      : null;

    webviewView.webview.postMessage({
      type: 'workspaceInfo',
      workspace: workspaceInfo
    });
  }

  /**
   * Open VSCode diff editor
   */
  private async openDiffEditor(oldContent: string, newContent: string, fileName: string): Promise<void> {
    // Create temporary documents for diff view
    const oldUri = vscode.Uri.parse(`echode-diff:${fileName}.old`);
    const newUri = vscode.Uri.parse(`echode-diff:${fileName}.new`);

    // Register text document content provider
    const provider = new class implements vscode.TextDocumentContentProvider {
      provideTextDocumentContent(uri: vscode.Uri): string {
        if (uri.path.endsWith('.old')) {
          return oldContent || '';
        }
        return newContent;
      }
    };

    const registration = vscode.workspace.registerTextDocumentContentProvider('echode-diff', provider);

    try {
      // Open diff editor
      await vscode.commands.executeCommand(
        'vscode.diff',
        oldUri,
        newUri,
        `${fileName} (Proposed Changes)`,
        { preview: true }
      );
    } finally {
      // Clean up after a delay to allow the diff to open
      setTimeout(() => registration.dispose(), 1000);
    }
  }

  /**
   * Open settings panel
   */
  public openSettingsPanel(): void {
    const panel = vscode.window.createWebviewPanel(
      'echodeSettings',
      'Echode Settings',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist')
        ]
      }
    );

    panel.webview.html = getSettingsHtml(panel.webview, this._extensionUri);

    panel.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'saveSettings':
          if (this._view) {
            this._view.webview.postMessage({ type: 'settingsSaved', settings: data.settings });
          }
          break;
        case 'closeSettings':
          panel.dispose();
          break;
        case 'apiRequest':
          await handleApiRequest(data, panel);
          break;
        case 'fetchModels':
          await handleModelFetch(data, panel);
          break;
      }
    });
  }

  /**
   * Resolve webview view
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
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

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'info':
          vscode.window.showInformationMessage(data.message);
          break;
        case 'error':
          vscode.window.showErrorMessage(data.message);
          break;
        case 'apiRequest':
          await handleApiRequest(data, webviewView);
          break;
        case 'chatStream':
          await handleChatStream(data, webviewView);
          break;
        case 'chatStreamAbort':
          await handleChatStream(data, webviewView);
          break;
        case 'fetchModels':
          await handleModelFetch(data, webviewView);
          break;
        case 'openDiff':
          await this.openDiffEditor(data.oldContent, data.newContent, data.fileName);
          break;
        case 'requestWorkspaceInfo':
          this.sendWorkspaceInfo(webviewView);
          break;
        case 'executeTool':
          await handleToolExecution(data, webviewView);
          break;
        case 'saveSession':
          await this._historyService.saveSession(data.session);
          break;
        case 'getSession':
          const session = await this._historyService.getSession(data.sessionId);
          webviewView.webview.postMessage({ type: 'sessionLoaded', session });
          break;
        case 'getAllSessions':
          const sessions = await this._historyService.getAllSessions();
          webviewView.webview.postMessage({ type: 'sessionsLoaded', sessions });
          break;
        case 'deleteSession':
          await this._historyService.deleteSession(data.sessionId);
          const updatedSessions = await this._historyService.getAllSessions();
          webviewView.webview.postMessage({ type: 'sessionsUpdated', sessions: updatedSessions });
          // Notify webview that a session was deleted so it can clear the chat if it's the current one
          webviewView.webview.postMessage({ type: 'sessionDeleted', sessionId: data.sessionId });
          break;
        case 'historyPanelClosed':
          this._isHistoryOpen = false;
          break;
        case 'fetchDiagnostics':
          await this.handleDiagnosticsFetch(data, webviewView);
          break;
        case 'undoToolExecutions':
          const workspaceForToolUndo = vscode.workspace.workspaceFolders;
          if (workspaceForToolUndo && workspaceForToolUndo.length > 0) {
            try {
              const toolExecutions = new Map<string, ToolExecutionState>(data.toolExecutions);
              const result = await this._toolHistoryService.undoToolExecutions(
                toolExecutions,
                workspaceForToolUndo[0].uri.fsPath
              );
              webviewView.webview.postMessage({
                type: 'toolExecutionsUndone',
                requestId: data.requestId,
                success: result.success,
                errors: result.errors,
              });
            } catch (error) {
              console.error('[ToolHistory] Error undoing tool executions:', error);
              webviewView.webview.postMessage({
                type: 'toolExecutionsError',
                error: error instanceof Error ? error.message : 'Failed to undo tool executions',
                requestId: data.requestId,
              });
            }
          }
          break;
        case 'redoToolExecutions':
          const workspaceForToolRedo = vscode.workspace.workspaceFolders;
          if (workspaceForToolRedo && workspaceForToolRedo.length > 0) {
            try {
              const toolExecutions = new Map<string, ToolExecutionState>(data.toolExecutions);
              const result = await this._toolHistoryService.redoToolExecutions(
                toolExecutions,
                workspaceForToolRedo[0].uri.fsPath
              );
              webviewView.webview.postMessage({
                type: 'toolExecutionsRedone',
                requestId: data.requestId,
                success: result.success,
                errors: result.errors,
              });
            } catch (error) {
              console.error('[ToolHistory] Error redoing tool executions:', error);
              webviewView.webview.postMessage({
                type: 'toolExecutionsError',
                error: error instanceof Error ? error.message : 'Failed to redo tool executions',
                requestId: data.requestId,
              });
            }
          }
          break;
        case 'setSessionUiState':
          await this._historyService.setSessionUiState(
            data.sessionId,
            data.editingMessageId,
            data.revertPreviewMessageId
          );
          break;
        case 'getSessionUiState':
          const uiState = await this._historyService.getSessionUiState(data.sessionId);
          webviewView.webview.postMessage({
            type: 'sessionUiStateLoaded',
            sessionId: data.sessionId,
            uiState
          });
          break;
      }
    });
  }

  /**
   * Handle diagnostics fetch request from webview
   */
  private async handleDiagnosticsFetch(
    data: { requestId: string; filePath: string; absolutePath: string },
    webviewView: vscode.WebviewView
  ): Promise<void> {
    try {
      const diagnosticsService = DiagnosticsService.getInstance();
      const diagnostics: unknown[] = [];
      
      if (diagnosticsService.isEnabled()) {
        try {
          const captured = await diagnosticsService.captureDiagnosticsForFile(data.absolutePath, {
            delay: diagnosticsService.getConfig('delay', 300),
            timeout: diagnosticsService.getConfig('timeout', 2500),
          });
          diagnostics.push(...captured);
        } catch (diagError) {
          console.warn('[DiagnosticsFetch] Failed to capture diagnostics:', diagError);
        }
      }

      webviewView.webview.postMessage({
        type: 'diagnosticsFetched',
        requestId: data.requestId,
        diagnostics,
      });
    } catch (error) {
      console.error('[DiagnosticsFetch] Error:', error);
      webviewView.webview.postMessage({
        type: 'diagnosticsFetched',
        requestId: data.requestId,
        diagnostics: [],
      });
    }
  }
}
