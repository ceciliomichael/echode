import * as vscode from 'vscode';
import { getSettingsHtml, getMermaidPreviewHtml, getMainWebviewHtml } from '../utils/html-generator';
import { handleApiRequest } from '../handlers/api-handler';
import { handleChatStream } from '../handlers/chat-streaming-handler';
import { handleModelFetch } from '../handlers/model-fetching-handler';
import { handleToolExecution } from '../handlers/tool-execution-handler';
import { handleSearchFiles, handleSearchWorkflows } from './handlers/search-handler';
import { getSettingsService } from '../services/settings-service';
import { handleMcpMessage, setupMcpStatusListener } from './handlers/mcp-handler';
import { handleGetWorkflows, handleSaveWorkflow, handleDeleteWorkflow } from './handlers/workflow-handler';
import { createMessageRouter, HandlerContext } from './message-router';
import type { AutocompleteService } from '../autocomplete';
import type { ChatHistoryService } from '../services/chat-history-service';
import type { ToolHistoryService } from '../services/tool-history';
import type { WorkspaceManager } from './workspace-manager';

/**
 * Panel Manager
 * Manages settings panel, mermaid preview panels, and diff editor
 */
export class PanelManager {
  private _settingsPanel?: vscode.WebviewPanel;
  private _mermaidPanels = new Map<string, vscode.WebviewPanel>();
  private _messageRouter = createMessageRouter();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _autocompleteService: AutocompleteService,
    private readonly _onSettingsSaved?: (settings: unknown) => void
  ) {}

  /**
   * Get the settings panel if it exists
   */
  public get settingsPanel(): vscode.WebviewPanel | undefined {
    return this._settingsPanel;
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
      'EchoDE Settings',
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
    const statusListener = setupMcpStatusListener(panel);
    panel.onDidDispose(() => {
      statusListener.dispose();
      this._settingsPanel = undefined;
    });

    panel.webview.html = getSettingsHtml(panel.webview, this._extensionUri);

    panel.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'saveSettings':
          // Notify main webview about settings saved
          this._onSettingsSaved?.(data.settings);
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
          // Sync autocomplete service with updated settings
          this._autocompleteService.updateSettings(data.settings);
          panel.webview.postMessage({ type: 'apiSettingsSaved' });
          break;
        case 'clearApiSettings':
          getSettingsService().clearSettings();
          panel.webview.postMessage({ type: 'apiSettingsCleared' });
          break;
        case 'getWorkflows':
          await handleGetWorkflows(data, panel);
          break;
        case 'saveWorkflow':
          await handleSaveWorkflow(data, panel);
          break;
        case 'deleteWorkflow':
          await handleDeleteWorkflow(data, panel);
          break;
        default:
          if (data.type && data.type.startsWith('mcp.')) {
            await handleMcpMessage(data, panel);
          }
          break;
      }
    });
  }

  /**
   * Open Mermaid preview panel
   * Uses unified webview approach - loads the same React bundle as settings/sidebar
   */
  public openMermaidPreviewPanel(
    code: string,
    id: string | undefined,
    onClosed?: (id?: string) => void
  ): void {
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
        localResourceRoots: [
          vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist')
        ]
      }
    );

    // Store panel if ID provided
    if (id) {
      this._mermaidPanels.set(id, panel);
    }

    panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'icon.svg');
    panel.webview.html = getMermaidPreviewHtml(panel.webview, this._extensionUri, code, id);

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

    // Notify when panel is closed
    panel.onDidDispose(() => {
      if (id) {
        this._mermaidPanels.delete(id);
      }
      onClosed?.(id);
    });
  }

  /**
   * Open Parallel Chat Panel
   */
  public openParallelChat(
    sessionId: string,
    services: {
      historyService: ChatHistoryService;
      toolHistoryService: ToolHistoryService;
      workspaceManager: WorkspaceManager;
    }
  ): void {
    const panel = vscode.window.createWebviewPanel(
      'echode.parallelChat',
      'EchoDE Chat',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist')
        ]
      }
    );

    panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'icon.svg');
    panel.webview.html = getMainWebviewHtml(panel.webview, this._extensionUri);

    // Send initialization message with session ID
    panel.webview.postMessage({ type: 'setSessionId', sessionId });
    
    // Send initial workspace info
    services.workspaceManager.sendWorkspaceInfo(panel.webview);

    // Create handler context for message router
    const handlerContext: HandlerContext = {
      webview: panel,
      historyService: services.historyService,
      toolHistoryService: services.toolHistoryService,
      workspaceManager: services.workspaceManager,
      panelManager: this,
      autocompleteService: this._autocompleteService,
      setHistoryOpen: (_open: boolean) => { /* No history modal in parallel chat */ }
    };

    panel.webview.onDidReceiveMessage(async (data) => {
      // Re-send session ID when webview requests workspace info (ensures session ID is set after reload/init)
      if (data.type === 'requestWorkspaceInfo') {
        panel.webview.postMessage({ type: 'setSessionId', sessionId });
      }

      // Intercept getLastOpenedSessionId to force the parallel session ID
      // This prevents the webview from loading the global "last opened session" (from sidebar)
      // if the initial setSessionId message was missed due to race conditions.
      if (data.type === 'getLastOpenedSessionId') {
        panel.webview.postMessage({ type: 'lastOpenedSessionId', sessionId });
        return;
      }

      // Try to route through the message router first
      const handled = await this._messageRouter.route(data, handlerContext);
      if (handled) {
        return;
      }

      // Handle MCP messages
      if (typeof data.type === 'string' && data.type.startsWith('mcp.')) {
        await handleMcpMessage(data, panel);
        return;
      }

      // Handle messages not covered by the router (external handlers)
      switch (data.type) {
        case 'apiRequest':
          await handleApiRequest(data, panel);
          break;
        case 'chatStream':
        case 'chatStreamAbort':
          await handleChatStream(data, panel);
          break;
        case 'fetchModels':
          await handleModelFetch(data, panel);
          break;
        case 'executeTool':
        case 'abortToolExecution':
          await handleToolExecution(data, panel);
          break;
        case 'searchFiles':
          await handleSearchFiles(data, panel);
          break;
        case 'searchWorkflows':
          await handleSearchWorkflows(data, panel);
          break;
        case 'getWorkflows':
          await handleGetWorkflows(data, panel);
          break;
        case 'saveWorkflow':
          await handleSaveWorkflow(data, panel);
          break;
        case 'deleteWorkflow':
          await handleDeleteWorkflow(data, panel);
          break;
      }
    });
  }

  /**
   * Open VSCode diff editor
   */
  public async openDiffEditor(oldContent: string, newContent: string, fileName: string): Promise<void> {
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
   * Dispose all panels
   */
  public dispose(): void {
    this._settingsPanel?.dispose();
    this._mermaidPanels.forEach(panel => panel.dispose());
    this._mermaidPanels.clear();
  }
}