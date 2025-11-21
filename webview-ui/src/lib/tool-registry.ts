/**
 * Tool handler registry implementing Open/Closed Principle
 * New tools can be added by registering handlers without modifying core logic
 */

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Tool, ToolExecutionResult } from '../types/tool';
import { getAllToolPlugins } from './tools/tool-plugin';
// Import tools to trigger auto-registration
import './tools/read-file-tool.tsx';
import './tools/write-file-tool.tsx';
import './tools/list-files-tool.tsx';
import './tools/grep-search-tool.tsx';
import './tools/glob-search-tool.tsx';
import './tools/delete-file-tool.tsx';
import './tools/edit-file-tool.tsx';
import './tools/multi-edit-tool.tsx';
import './tools/todo-write-tool.tsx';
import './tools/todo-read-tool.tsx';

/**
 * Tool status callback for mid-execution updates
 */
export type ToolStatusCallback = (status: 'executing' | 'completed') => void;

/**
 * Tool handler interface - abstracts tool execution logic
 */
export interface ToolHandler {
  execute(
    parameters: Record<string, unknown>,
    signal?: AbortSignal,
    onStatusChange?: ToolStatusCallback,
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
    enabled: defaultEnabled,
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
