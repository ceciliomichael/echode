import * as vscode from 'vscode';
import type { ChatHistoryService } from '../services/chat-history-service';
import type { ToolHistoryService } from '../services/tool-history';
import type { WorkspaceManager } from './workspace-manager';
import type { PanelManager } from './panel-manager';
import type { AutocompleteService } from '../autocomplete';

/**
 * Message Router
 * Registry-based message routing to replace the giant switch statement
 */

/**
 * Context provided to all message handlers
 */
export interface HandlerContext {
  webview: vscode.WebviewView;
  historyService: ChatHistoryService;
  toolHistoryService: ToolHistoryService;
  workspaceManager: WorkspaceManager;
  panelManager: PanelManager;
  autocompleteService: AutocompleteService;
  setHistoryOpen: (open: boolean) => void;
}

/**
 * Message handler function signature
 */
export type MessageHandler = (
  data: Record<string, unknown>,
  context: HandlerContext
) => Promise<void> | void;

/**
 * Message Router class
 * Provides registry-based message routing
 */
export class MessageRouter {
  private handlers = new Map<string, MessageHandler>();

  /**
   * Register a handler for a message type
   */
  public register(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Register multiple handlers at once
   */
  public registerAll(handlers: Record<string, MessageHandler>): void {
    for (const [type, handler] of Object.entries(handlers)) {
      this.register(type, handler);
    }
  }

  /**
   * Route a message to its handler
   * Returns true if a handler was found and executed
   */
  public async route(
    data: { type: string } & Record<string, unknown>,
    context: HandlerContext
  ): Promise<boolean> {
    const handler = this.handlers.get(data.type);
    if (handler) {
      await handler(data, context);
      return true;
    }
    return false;
  }

  /**
   * Check if a handler exists for a message type
   */
  public hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }

  /**
   * Get all registered message types
   */
  public getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Create and configure the default message router with all handlers
 */
export function createMessageRouter(): MessageRouter {
  const router = new MessageRouter();

  // Import handlers inline to avoid circular dependencies
  const {
    handleSaveSession,
    handleGetSession,
    handleGetLatestSession,
    handleGetAllSessions,
    handleDeleteSession,
    handleSetSessionUiState,
    handleGetSessionUiState,
    handleUndoToolExecutions,
    handleRedoToolExecutions,
    handleGetApiSettings,
    handleSaveApiSettings,
    handleClearApiSettings,
    handleGetChatMode,
    handleSaveChatMode,
    handleInfo,
    handleError,
    handleOpenFileInTab,
    handleHistoryPanelClosed,
  } = require('./handlers');

  // Session handlers
  router.register('saveSession', async (data, ctx) => {
    await handleSaveSession(data, ctx.webview, ctx.historyService);
  });

  router.register('getSession', async (data, ctx) => {
    await handleGetSession(data, ctx.webview, ctx.historyService);
  });

  router.register('getLatestSession', async (data, ctx) => {
    await handleGetLatestSession(data, ctx.webview, ctx.historyService);
  });

  router.register('getAllSessions', async (data, ctx) => {
    await handleGetAllSessions(data, ctx.webview, ctx.historyService);
  });

  router.register('deleteSession', async (data, ctx) => {
    await handleDeleteSession(data, ctx.webview, ctx.historyService);
  });

  router.register('setSessionUiState', async (data, ctx) => {
    await handleSetSessionUiState(data, ctx.webview, ctx.historyService);
  });

  router.register('getSessionUiState', async (data, ctx) => {
    await handleGetSessionUiState(data, ctx.webview, ctx.historyService);
  });

  // Tool history handlers
  router.register('undoToolExecutions', async (data, ctx) => {
    await handleUndoToolExecutions(data, ctx.webview, ctx.toolHistoryService);
  });

  router.register('redoToolExecutions', async (data, ctx) => {
    await handleRedoToolExecutions(data, ctx.webview, ctx.toolHistoryService);
  });

  // Settings handlers
  router.register('getApiSettings', async (data, ctx) => {
    await handleGetApiSettings(data, ctx.webview);
  });

  router.register('saveApiSettings', async (data, ctx) => {
    await handleSaveApiSettings(data, ctx.webview);
    // Sync autocomplete service with updated settings
    if (data.settings) {
      ctx.autocompleteService.updateSettings(data.settings as Parameters<AutocompleteService['updateSettings']>[0]);
    }
  });

  router.register('clearApiSettings', async (data, ctx) => {
    await handleClearApiSettings(data, ctx.webview);
  });

  router.register('getChatMode', async (data, ctx) => {
    await handleGetChatMode(data, ctx.webview);
  });

  router.register('saveChatMode', async (data, ctx) => {
    await handleSaveChatMode(data, ctx.webview);
  });

  // UI handlers
  router.register('info', async (data, ctx) => {
    await handleInfo(data, ctx.webview);
  });

  router.register('error', async (data, ctx) => {
    await handleError(data, ctx.webview);
  });

  router.register('openFileInTab', async (data, ctx) => {
    await handleOpenFileInTab(data, ctx.webview);
  });

  router.register('historyPanelClosed', (_data, ctx) => {
    const isOpen = handleHistoryPanelClosed();
    ctx.setHistoryOpen(isOpen);
  });

  // Workspace handlers
  router.register('requestWorkspaceInfo', (_data, ctx) => {
    ctx.workspaceManager.sendWorkspaceInfo(ctx.webview.webview);
  });

  // Todo handlers
  router.register('clearTodos', () => {
    // Import inline to avoid circular dependency
    const { TodoWriteTool } = require('../services/tools/todo-write-tool');
    TodoWriteTool.clearTodos();
  });

  // Panel handlers
  router.register('openDiff', async (data, ctx) => {
    await ctx.panelManager.openDiffEditor(
      data.oldContent as string,
      data.newContent as string,
      data.fileName as string
    );
  });

  router.register('openMermaidPreview', (data, ctx) => {
    ctx.panelManager.openMermaidPreviewPanel(
      data.text as string,
      data.id as string | undefined,
      (id) => {
        ctx.webview.webview.postMessage({
          type: 'mermaidPreviewClosed',
          id
        });
      }
    );
  });

  return router;
}