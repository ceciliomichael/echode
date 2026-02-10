/**
 * Sidebar Module Barrel Export
 */

// Managers
export { WorkspaceManager, detectShellType } from './workspace-manager';
export { PanelManager } from './panel-manager';

// Message Router
export { MessageRouter, createMessageRouter } from './message-router';
export type { HandlerContext, MessageHandler } from './message-router';

// Handlers
export * from './handlers';