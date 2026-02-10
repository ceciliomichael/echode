import * as vscode from 'vscode';
import * as os from 'os';
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
import { getSubAgentService } from '../services/sub-agent/sub-agent-service';
import { SubAgentSession } from '../services/sub-agent/types';
import type { AutocompleteService } from '../autocomplete';
import { ChatHistoryService, ChatSession } from '../services/chat-history-service';
import type { ToolHistoryService } from '../services/tool-history';
import { type WorkspaceManager, detectShellType } from './workspace-manager';
import { buildSubAgentPrompt } from '../utils/sub-agent/prompt-builder';
import { getAgentsConfig } from '../utils/workspace-scanner';

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
   * Open Sub-Agent Panel
   */
  public async openSubAgentPanel(
    session: SubAgentSession,
    services: {
      historyService: ChatHistoryService;
      toolHistoryService: ToolHistoryService;
      workspaceManager: WorkspaceManager;
    }
  ): Promise<void> {
    const service = getSubAgentService();
    const definition = service.getDefinition(session.subAgentId);
    
    if (!definition) {
      throw new Error(`Sub-agent definition not found: ${session.subAgentId}`);
    }

    const panel = vscode.window.createWebviewPanel(
      'echode.subAgent',
      `Sub-Agent: ${definition.name}`,
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
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

    // Generate collaborator context (other active agents)
    const activeSessions = service.getActiveSessions(session.id);
    let collaboratorContext = '';
    
    if (activeSessions.length > 0) {
      const collaborators = activeSessions.map(s => {
        const def = service.getDefinition(s.subAgentId);
        return `- Agent "${def?.name || 'Unknown'}": ${s.task}`;
      }).join('\n');
      
      collaboratorContext = `\n\n[COLLABORATION CONTEXT]\nThe following other agents are currently working on related tasks. If your task depends on their work (e.g., using UI components they are building), assume standard conventions or coordinate implicitly:\n${collaborators}`;
    }

    // Load AGENTS.md context if available
    let agentsContext = '';
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      const config = getAgentsConfig(workspaceRoot);
      if (config) {
        agentsContext = `\n\n[AGENTS REGISTRY]\n${config}`;
      }
    }

    // Prepare system info
    const systemInfo = {
      os: os.platform() === 'win32' ? 'Windows' : os.platform() === 'darwin' ? 'macOS' : 'Linux',
      workspacePath: workspaceRoot || '',
      currentTime: new Date().toLocaleString(),
      shellType: detectShellType(),
    };

    // Initialize chat history for this session
    const effectiveSettings = getSettingsService().getEffectiveSettings(workspaceRoot);
    const systemPromptContent = buildSubAgentPrompt(definition, collaboratorContext, agentsContext, systemInfo, {
      model: effectiveSettings.model
    });

    const systemMessage = {
      id: 'system',
      role: 'system',
      content: systemPromptContent,
      timestamp: new Date().toISOString(),
      hidden: true // Hide system prompt from UI to prevent "messed up" display
    };

    const newSession: ChatSession = {
      id: session.id,
      title: `Sub-Agent: ${definition.name}`,
      timestamp: Date.now(),
      createdAt: Date.now(),
      workspaceId: 'global', // Will be overwritten by saveSession with correct workspaceId
      messages: [systemMessage],
      metadata: {
        messageCount: 1,
        preview: 'Sub-Agent Session'
      },
      isSubAgent: true
    };

    // Save initial history
    await services.historyService.saveSession(newSession);

    // Handle panel disposal (user closed the tab)
    panel.onDidDispose(() => {
      const currentSession = service.getSession(session.id);
      // If session is still pending or running when panel closes, fail it to unblock the main agent
      if (currentSession && (currentSession.status === 'pending' || currentSession.status === 'running')) {
        service.failSession(session.id, 'Sub-agent panel was closed before completion.');
      }
    });

    // Initialize webview
    panel.webview.postMessage({ type: 'setSessionId', sessionId: session.id });
    
    // Set sub-agent mode in webview
    panel.webview.postMessage({ 
      type: 'setSubAgentMode', 
      enabled: true,
      initialTask: session.task,
      allowedTools: definition.allowedTools
    });
    
    // Send initial workspace info
    services.workspaceManager.sendWorkspaceInfo(panel.webview);

    // Create handler context
    const handlerContext: HandlerContext = {
      webview: panel,
      historyService: services.historyService,
      toolHistoryService: services.toolHistoryService,
      workspaceManager: services.workspaceManager,
      panelManager: this,
      autocompleteService: this._autocompleteService,
      setHistoryOpen: (_open: boolean) => { /* No history in sub-agent view */ }
    };

    // Safety flag to block API requests after session completion
    let sessionCompleted = false;

    panel.webview.onDidReceiveMessage(async (data) => {
      // Block all API requests after session is completed
      if (sessionCompleted) {
        if (data.type === 'chatStream' || data.type === 'apiRequest') {
          console.log(`[SubAgent] Blocking ${data.type} - session already completed`);
          return;
        }
      }
      // Re-send session/mode info on request
      if (data.type === 'requestWorkspaceInfo') {
        panel.webview.postMessage({ type: 'setSessionId', sessionId: session.id });
        panel.webview.postMessage({ 
          type: 'setSubAgentMode', 
          enabled: true, 
          initialTask: session.task,
          allowedTools: definition.allowedTools
        });
      }

      if (data.type === 'getLastOpenedSessionId') {
        panel.webview.postMessage({ type: 'lastOpenedSessionId', sessionId: session.id });
        return;
      }

      // Route messages
      const handled = await this._messageRouter.route(data, handlerContext);
      if (handled) {
        return;
      }

      // Handle MCP
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
        case 'completeSubAgentSession':
          // Handle manual completion triggered by "Finish & Report" button
          {
            const summary = data.summary as string;
            const currentSession = service.getSession(session.id);
            
            if (currentSession && (currentSession.status === 'pending' || currentSession.status === 'running')) {
              service.resolveSession(session.id, { summary });
              sessionCompleted = true;
              
              // Give the webview time to persist session/tool history so revert can undo sub-agent changes
              setTimeout(() => {
                try {
                  panel.dispose();
                } catch {
                  // ignore
                }
              }, 500);
            }
          }
          break;
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
      setHistoryOpen: (_open: boolean) => { /* No history modal in parallel chat */ },
      isParallelChat: true
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
    // Note: In a real implementation, we should manage this provider globally to avoid leaks/duplicates,
    // but for this specific method scope it handles the immediate diff request.
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
}