import type { ToolExecutionState } from '../../types/tool-execution';
import { ToolHistoryHandlerRegistry } from './handlers';

/**
 * Service for managing tool execution history and undo/redo operations
 * Uses handler registry pattern for extensibility
 */
export class ToolHistoryService {
  private readonly handlerRegistry: ToolHistoryHandlerRegistry;

  constructor(handlerRegistry?: ToolHistoryHandlerRegistry) {
    this.handlerRegistry = handlerRegistry ?? new ToolHistoryHandlerRegistry();
  }

  /**
   * Register a new tool history handler
   */
  public registerHandler(handler: import('./handlers').IToolHistoryHandler): void {
    this.handlerRegistry.register(handler);
  }

  /**
   * Undo a single tool execution by reversing its effects
   */
  async undoToolExecution(
    toolExecution: ToolExecutionState,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!toolExecution.result?.success || !toolExecution.result.data) {
      console.log(`[ToolHistory] Skipping undo for ${toolExecution.toolName} (no successful result)`);
      return { success: true }; // Nothing to undo if tool failed
    }

    const { toolName } = toolExecution;
    const data = toolExecution.result.data as Record<string, unknown>;
    console.log(`[ToolHistory] Undoing ${toolName}:`, data.path || data);

    try {
      const handler = this.handlerRegistry.getHandler(toolName);

      if (handler) {
        return await handler.undo(toolName, data, workspacePath);
      }

      // Read-only tools and unknown tools don't need undo
      if (this.isReadOnlyTool(toolName)) {
        return { success: true };
      }

      console.warn(`[ToolHistory] Unknown tool for undo: ${toolName}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to undo ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Undo multiple tool executions in reverse order
   */
  async undoToolExecutions(
    toolExecutions: Map<string, ToolExecutionState>,
    workspacePath: string
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Convert to array and reverse (undo in reverse order of execution)
    const executionsArray = Array.from(toolExecutions.values()).reverse();

    for (const execution of executionsArray) {
      const result = await this.undoToolExecution(execution, workspacePath);
      if (!result.success && result.error) {
        errors.push(result.error);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Redo a single tool execution by re-applying its effects
   */
  async redoToolExecution(
    toolExecution: ToolExecutionState,
    workspacePath: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!toolExecution.result?.success || !toolExecution.result.data) {
      console.log(`[ToolHistory] Skipping redo for ${toolExecution.toolName} (no successful result)`);
      return { success: true }; // Nothing to redo if tool failed
    }

    const { toolName } = toolExecution;
    const data = toolExecution.result.data as Record<string, unknown>;
    console.log(`[ToolHistory] Redoing ${toolName}:`, data.path || data);

    try {
      const handler = this.handlerRegistry.getHandler(toolName);

      if (handler) {
        return await handler.redo(toolName, data, workspacePath);
      }

      // Read-only tools and unknown tools don't need redo
      if (this.isReadOnlyTool(toolName)) {
        return { success: true };
      }

      console.warn(`[ToolHistory] Unknown tool for redo: ${toolName}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to redo ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Redo multiple tool executions in original order
   */
  async redoToolExecutions(
    toolExecutions: Map<string, ToolExecutionState>,
    workspacePath: string
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Convert to array in original order (redo in forward order)
    const executionsArray = Array.from(toolExecutions.values());

    for (const execution of executionsArray) {
      const result = await this.redoToolExecution(execution, workspacePath);
      if (!result.success && result.error) {
        errors.push(result.error);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if a tool is read-only (doesn't modify state)
   */
  private isReadOnlyTool(toolName: string): boolean {
    const readOnlyTools = [
      'read_file',
      'list_files',
      'grep_search',
      'glob_search',
      'get_diagnostics',
    ];
    return readOnlyTools.includes(toolName);
  }
}