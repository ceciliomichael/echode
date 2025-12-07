import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { handleApiRequest } from './handlers/api-handler';
import { handleChatStream } from './handlers/chat-streaming-handler';
import { handleModelFetch } from './handlers/model-fetching-handler';
import { handleToolExecution, setFileModificationCallback } from './handlers/tool-execution-handler';
import { handleContextSummarizer } from './handlers/context-summarizer-handler';
import { getMainWebviewHtml, getSettingsHtml, getMermaidPreviewHtml } from './utils/html-generator';
import { getWorkspaceFiles, getAgentsConfig } from './utils/workspace-scanner';
import { ChatHistoryService } from './services/chat-history-service';
import { ToolHistoryService } from './services/tool-history-service';
import { getSettingsService } from './services/settings-service';

import { AutocompleteService } from './autocomplete';
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
  private _settingsPanel?: vscode.WebviewPanel;
  private _mermaidPanels = new Map<string, vscode.WebviewPanel>();
  private _autocompleteService: AutocompleteService;
  private _fileWatcher?: vscode.FileSystemWatcher;
  private _workspaceUpdateDebounce?: NodeJS.Timeout;
  private _refactorScanInProgress: boolean = false;
  private _refactorScanComplete: boolean = false;
  private _cachedLargeFiles: { path: string; lineCount: number }[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext,
    autocompleteService: AutocompleteService
  ) {
    this._autocompleteService = autocompleteService;
    const workspacePath = this.getCurrentWorkspacePath();
    this._historyService = new ChatHistoryService(_context, workspacePath);
    this._toolHistoryService = new ToolHistoryService();

    // Listen for workspace folder changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const newWorkspacePath = this.getCurrentWorkspacePath();
      this._historyService.updateWorkspace(newWorkspacePath);
      this.setupFileWatcher();
    });

    // When files are modified via write_to_file or apply_diff tools, we want to
    // rescan the workspace for large/refactor-sensitive files. We expose a
    // callback from the tool execution handler that we hook here.
    setFileModificationCallback(() => {
      // Reset cached refactor scan state so that a fresh scan is performed
      this._refactorScanComplete = false;
      this._cachedLargeFiles = [];

      if (this._view) {
        this.sendRefactorScanResults(this._view);
      }
    });

    // Setup file watcher for workspace file changes
    this.setupFileWatcher();
  }

  private getCurrentWorkspacePath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : undefined;
  }

  /**
   * Setup file system watcher to detect file changes in workspace
   */
  private setupFileWatcher(): void {
    // Dispose existing watcher if any
    this._fileWatcher?.dispose();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    // Watch for all file changes in workspace
    this._fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolders[0], '**/*')
    );

    // Debounced update to avoid excessive refreshes
    const debouncedUpdate = () => {
      if (this._workspaceUpdateDebounce) {
        clearTimeout(this._workspaceUpdateDebounce);
      }
      this._workspaceUpdateDebounce = setTimeout(() => {
        if (this._view) {
          this._refactorScanComplete = false;
          this._cachedLargeFiles = [];
          this.sendWorkspaceInfo(this._view);
        }
      }, 300);
    };

    // Listen for file create, delete, and rename events
    this._fileWatcher.onDidCreate(debouncedUpdate);
    this._fileWatcher.onDidDelete(debouncedUpdate);
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

    // Also send refactor scan results
    this.sendRefactorScanResults(webviewView);
  }

  /**
   * Send refactor scan results (large files) to webview
   * Spawns external Node process to avoid blocking extension host
   */
  private sendRefactorScanResults(webviewView: vscode.WebviewView): void {
    // If scan already completed, send cached results
    if (this._refactorScanComplete) {
      webviewView.webview.postMessage({
        type: 'refactorScanResults',
        largeFiles: this._cachedLargeFiles
      });
      return;
    }

    // Skip if scan already in progress
    if (this._refactorScanInProgress) {
      return;
    }
    this._refactorScanInProgress = true;

    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      this._refactorScanInProgress = false;
      this._refactorScanComplete = true;
      webviewView.webview.postMessage({
        type: 'refactorScanResults',
        largeFiles: []
      });
      return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(this._context.extensionPath, 'dist', 'scripts', 'scan-large-files.js');

    console.log('[Echode] Spawning scan script:', scriptPath);
    const startTime = Date.now();

    // Spawn external Node process
    const child = spawn('node', [scriptPath, workspacePath, '300'], {
      cwd: workspacePath,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Timeout after 10 seconds – only used if scan never completes
    const timeout = setTimeout(() => {
      // If scan already finished, don't override results
      if (this._refactorScanComplete) {
        return;
      }

      this._refactorScanInProgress = false;
      this._refactorScanComplete = true;
      this._cachedLargeFiles = [];

      if (!child.killed) {
        child.kill();
      }

      webviewView.webview.postMessage({
        type: 'refactorScanResults',
        largeFiles: []
      });
    }, 10000);

    child.on('close', (code) => {
      const elapsed = Date.now() - startTime;
      console.log(`[Echode] Scan completed in ${elapsed}ms, exit code: ${code}`);

      // Scan finished before timeout - prevent timeout handler from firing
      clearTimeout(timeout);

      this._refactorScanInProgress = false;
      this._refactorScanComplete = true;

      let largeFiles: { path: string; lineCount: number }[] = [];

      if (code === 0 && stdout) {
        try {
          largeFiles = JSON.parse(stdout);
          console.log(`[Echode] Found ${largeFiles.length} large files`);
        } catch {
          console.error('[Echode] Failed to parse scan results:', stdout);
        }
      } else if (stderr) {
        console.error('[Echode] Scan script error:', stderr);
      }

      // Cache results for subsequent requests
      this._cachedLargeFiles = largeFiles;

      webviewView.webview.postMessage({
        type: 'refactorScanResults',
        largeFiles
      });
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
   * Open settings panel (singleton - only one instance allowed)
   */
  public openSettingsPanel(): void {
    // If panel already exists, reveal it instead of creating a new one
    if (this._settingsPanel) {
      this._settingsPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Create panel and immediately store reference to prevent race conditions
    this._settingsPanel = vscode.window.createWebviewPanel(
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

    const panel = this._settingsPanel;

    // Set extension icon for the tab
    panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'icon.svg');

    // Clear reference when panel is disposed
    panel.onDidDispose(() => {
      this._settingsPanel = undefined;
    });

    panel.webview.html = getSettingsHtml(panel.webview, this._extensionUri);

    panel.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'saveSettings':
          if (this._view) {
            this._view.webview.postMessage({ type: 'settingsSaved', settings: data.settings });
          }
          // Update autocomplete service with new settings
          this._autocompleteService.updateSettings(data.settings);
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
        case 'getApiSettings':
          const settingsPanelSettings = getSettingsService().getSettings();
          panel.webview.postMessage({ type: 'apiSettingsLoaded', settings: settingsPanelSettings });
          break;
        case 'saveApiSettings':
          getSettingsService().saveSettings(data.settings);
          panel.webview.postMessage({ type: 'apiSettingsSaved' });
          break;
        case 'clearApiSettings':
          getSettingsService().clearSettings();
          panel.webview.postMessage({ type: 'apiSettingsCleared' });
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

    // Send initial workspace info and start refactor scan
    this.sendWorkspaceInfo(webviewView);

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
        case 'abortToolExecution':
          await handleToolExecution(data, webviewView);
          break;
        case 'saveSession':
          await this._historyService.saveSession(data.session);
          break;
        case 'getSession':
          const session = await this._historyService.getSession(data.sessionId);
          webviewView.webview.postMessage({ type: 'sessionLoaded', session, request: 'session', sessionId: data.sessionId });
          break;
        case 'getLatestSession':
          const latestSession = await this._historyService.getLatestSession();
          webviewView.webview.postMessage({ type: 'sessionLoaded', session: latestSession, request: 'latest' });
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
        case 'openFileInTab':
          // Open file in editor tab without stealing focus or switching active tab
          try {
            const fileUri = vscode.Uri.file(data.absolutePath);
            const previousActiveEditor = vscode.window.activeTextEditor;
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document, {
              preview: false,      // Open as permanent tab, not preview
              preserveFocus: true, // Don't steal focus from the sidebar
            });
            // Restore the previously active editor to keep it visible
            if (previousActiveEditor) {
              await vscode.window.showTextDocument(previousActiveEditor.document, {
                viewColumn: previousActiveEditor.viewColumn,
                preserveFocus: true,
              });
            }
          } catch (error) {
            console.warn('[OpenFileInTab] Failed to open file:', data.absolutePath, error);
          }
          break;

        case 'undoToolExecutions':
          const workspaceForToolUndo = vscode.workspace.workspaceFolders;
          const undoWorkspacePath = workspaceForToolUndo && workspaceForToolUndo.length > 0
            ? workspaceForToolUndo[0].uri.fsPath
            : '';

          try {
            const toolExecutions = new Map<string, ToolExecutionState>(data.toolExecutions);
            const result = await this._toolHistoryService.undoToolExecutions(
              toolExecutions,
              undoWorkspacePath
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
          break;
        case 'redoToolExecutions':
          const workspaceForToolRedo = vscode.workspace.workspaceFolders;
          const redoWorkspacePath = workspaceForToolRedo && workspaceForToolRedo.length > 0
            ? workspaceForToolRedo[0].uri.fsPath
            : '';

          try {
            const toolExecutions = new Map<string, ToolExecutionState>(data.toolExecutions);
            const result = await this._toolHistoryService.redoToolExecutions(
              toolExecutions,
              redoWorkspacePath
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
        case 'openMermaidPreview':
          this.openMermaidPreviewPanel(data.text, data.id);
          break;
        case 'summarizeContext':
          await handleContextSummarizer(data, webviewView);
          break;
        case 'getApiSettings':
          const apiSettings = getSettingsService().getSettings();
          webviewView.webview.postMessage({ type: 'apiSettingsLoaded', settings: apiSettings });
          break;
        case 'saveApiSettings':
          getSettingsService().saveSettings(data.settings);
          webviewView.webview.postMessage({ type: 'apiSettingsSaved' });
          break;
        case 'clearApiSettings':
          getSettingsService().clearSettings();
          webviewView.webview.postMessage({ type: 'apiSettingsCleared' });
          break;
      }
    });
  }

  /**
   * Open Mermaid preview panel
   */
  private openMermaidPreviewPanel(code: string, id?: string): void {
    // If ID provided and panel exists, just reveal it
    if (id && this._mermaidPanels.has(id)) {
      this._mermaidPanels.get(id)?.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'mermaidPreview',
      'Mermaid Preview',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: []
      }
    );

    // Store panel if ID provided
    if (id) {
      this._mermaidPanels.set(id, panel);
    }

    panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'icon.svg');
    panel.webview.html = getMermaidPreviewHtml(panel.webview, code);

    // Handle messages from the preview panel
    panel.webview.onDidReceiveMessage(async (data) => {
      if (data.type === 'saveMermaidSvg') {
        const uri = await vscode.window.showSaveDialog({
          filters: { 'SVG Images': ['svg'] },
          defaultUri: vscode.Uri.file('diagram.svg')
        });

        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(data.svg));
          vscode.window.showInformationMessage('Diagram saved successfully!');
        }
      }
    });

    // Notify sidebar webview when panel is closed
    panel.onDidDispose(() => {
      if (id) {
        this._mermaidPanels.delete(id);
      }
      if (this._view) {
        this._view.webview.postMessage({
          type: 'mermaidPreviewClosed',
          id // Send back ID so specific block can handle it
        });
      }
    });
  }


}
