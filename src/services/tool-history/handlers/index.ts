import type { IToolHistoryHandler } from './handler.interface';
import { FileOperationsHandler } from './file-operations-handler';
import { TodoOperationsHandler } from './todo-operations-handler';

export { IToolHistoryHandler } from './handler.interface';
export { FileOperationsHandler } from './file-operations-handler';
export { TodoOperationsHandler } from './todo-operations-handler';

/**
 * Registry for tool history handlers
 * Maps tool names to their respective handlers for undo/redo operations
 */
export class ToolHistoryHandlerRegistry {
  private handlers: Map<string, IToolHistoryHandler> = new Map();

  constructor() {
    // Register default handlers
    this.register(new FileOperationsHandler());
    this.register(new TodoOperationsHandler());
  }

  /**
   * Register a handler for its supported tools
   */
  register(handler: IToolHistoryHandler): void {
    for (const toolName of handler.supportedTools) {
      this.handlers.set(toolName, handler);
    }
  }

  /**
   * Get handler for a specific tool
   */
  getHandler(toolName: string): IToolHistoryHandler | undefined {
    return this.handlers.get(toolName);
  }

  /**
   * Check if a handler exists for a tool
   */
  hasHandler(toolName: string): boolean {
    return this.handlers.has(toolName);
  }

  /**
   * Get all registered tool names
   */
  getRegisteredTools(): string[] {
    return Array.from(this.handlers.keys());
  }
}