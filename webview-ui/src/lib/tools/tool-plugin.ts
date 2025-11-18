/**
 * Tool plugin interface for auto-registration
 */
import type {
  ToolHandler,
  ToolMetadata,
  ToolResultRenderer,
} from '../tool-registry';

export interface ToolPlugin {
  metadata: ToolMetadata;
  handler: ToolHandler;
  renderer?: ToolResultRenderer;
}

/**
 * Registry for tool plugins
 */
const toolPlugins: ToolPlugin[] = [];

/**
 * Register a tool plugin
 */
export function registerToolPlugin(plugin: ToolPlugin): void {
  toolPlugins.push(plugin);
}

/**
 * Get all registered tool plugins
 */
export function getAllToolPlugins(): ToolPlugin[] {
  return [...toolPlugins];
}
