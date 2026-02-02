/**
 * Tool handler registry implementing Open/Closed Principle
 * New tools can be added by registering handlers without modifying core logic
 */

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Cable } from 'lucide-react';
import type { Tool, ToolExecutionResult } from '../types/tool';
import { type ChatMode, type ToolProgress, executeToolViaExtension } from './tool-utils';
import { getAllToolPlugins } from './tools/tool-plugin';
import { TOOL_XML_NAMESPACE } from './tool-xml';
// Import tools to trigger auto-registration
import './tools/read-file-tool.tsx';
import './tools/write-file-tool.tsx';
import './tools/list-files-tool.tsx';
import './tools/grep-search-tool.tsx';
import './tools/glob-search-tool.tsx';
import './tools/delete-file-tool.tsx';
import './tools/todo-write-tool.tsx';
import './tools/edit-tool.tsx';
import './tools/get-diagnostics-tool.tsx';
import './tools/plan-tool.tsx';
import './tools/publish-findings-tool.tsx';
import './tools/run-terminal-tool.tsx';

/**
 * Tool status callback for mid-execution updates
 */
export type ToolStatusCallback = (status: 'executing' | 'completed') => void;

/**
 * Tool progress callback for streaming progress updates (e.g., terminal output)
 */
export type ToolProgressCallback = (progress: ToolProgress) => void;

/**
 * Tool handler interface - abstracts tool execution logic
 */
export interface ToolHandler {
  execute(
    parameters: Record<string, unknown>,
    signal?: AbortSignal,
    onStatusChange?: ToolStatusCallback,
    onProgress?: ToolProgressCallback,
    mode?: ChatMode,
  ): Promise<ToolExecutionResult>;
}

/**
 * Tool metadata for UI rendering
 */
export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  aiDescription?: string;
  icon: LucideIcon;
  usage: string;
  formatExample: string;
}

/**
 * Tool result renderer interface
 */
export type ToolResultRenderer = (data: unknown) => ReactNode;

/**
 * Registry for tool handlers
 */
const toolHandlers = new Map<string, ToolHandler>();

/**
 * Registry for tool metadata
 */
const toolMetadata = new Map<string, ToolMetadata>();

/**
 * Registry for tool result renderers
 */
const toolRenderers = new Map<string, ToolResultRenderer>();

/**
 * Register a tool handler
 */
export function registerToolHandler(
  toolId: string,
  handler: ToolHandler,
): void {
  toolHandlers.set(toolId, handler);
}

/**
 * Register tool metadata
 */
export function registerToolMetadata(metadata: ToolMetadata): void {
  toolMetadata.set(metadata.id, metadata);
}

/**
 * Register a tool result renderer
 */
export function registerToolRenderer(
  toolId: string,
  renderer: ToolResultRenderer,
): void {
  toolRenderers.set(toolId, renderer);
}

/**
 * Unregister a tool
 */
export function unregisterTool(toolId: string): void {
  toolHandlers.delete(toolId);
  toolMetadata.delete(toolId);
  toolRenderers.delete(toolId);
}

/**
 * Register a remote tool (e.g. from MCP)
 */
export function registerRemoteTool(
  toolInfo: { 
    name: string; 
    description: string; 
    inputSchema?: {
      type?: string;
      properties?: Record<string, {
        type?: string;
        description?: string;
        enum?: string[];
        items?: {
          type?: string;
        };
      }>;
      required?: string[];
    };
  }
): void {
  const toolId = toolInfo.name;
  
  // Register Metadata
  registerToolMetadata({
    id: toolId,
    name: toolInfo.name,
    description: toolInfo.description || 'Remote tool',
    aiDescription: toolInfo.description,
    icon: Cable,
    usage: `Use ${toolInfo.name}`,
    formatExample: `<${TOOL_XML_NAMESPACE}:invoke name="${toolInfo.name}">\n<${TOOL_XML_NAMESPACE}:parameter name="param">value</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>`,
  });

  // Register Handler
  registerToolHandler(toolId, {
    execute: async (parameters, signal, _onStatusChange, onProgress, mode) => {
      return executeToolViaExtension(toolId, parameters, signal, onProgress, mode);
    },
  });
}

/**
 * Get tool handler by id
 */
export function getToolHandler(toolId: string): ToolHandler | undefined {
  return toolHandlers.get(toolId);
}

/**
 * Get tool metadata by id
 */
export function getToolMetadata(toolId: string): ToolMetadata | undefined {
  return toolMetadata.get(toolId);
}

/**
 * Get tool result renderer by id
 */
export function getToolRenderer(
  toolId: string,
): ToolResultRenderer | undefined {
  return toolRenderers.get(toolId);
}

/**
 * Get all registered tools as Tool[] for configuration
 */
export function getAllTools(defaultEnabled = true): Tool[] {
  return Array.from(toolMetadata.values()).map((meta) => ({
    id: meta.id,
    name: meta.name,
    description: meta.description,
    aiDescription: meta.aiDescription,
    enabled: meta.id === 'run_terminal' ? false : defaultEnabled,
  }));
}

/**
 * Get all registered tool metadata
 */
export function getAllToolMetadata(): ToolMetadata[] {
  return Array.from(toolMetadata.values());
}

/**
 * Check if a tool is registered
 */
export function isToolRegistered(toolId: string): boolean {
  return toolMetadata.has(toolId);
}

/**
 * Get count of registered tools
 */
export function getToolCount(): number {
  return toolMetadata.size;
}

/**
 * Initialize tool plugins - loads all registered plugins into the registry
 */
export function initializeToolPlugins(): void {
  const plugins = getAllToolPlugins();
  for (const plugin of plugins) {
    registerToolHandler(plugin.metadata.id, plugin.handler);
    registerToolMetadata(plugin.metadata);
    if (plugin.renderer) {
      registerToolRenderer(plugin.metadata.id, plugin.renderer);
    }
  }
}

// Auto-initialize plugins on module load
initializeToolPlugins();
