import type { ToolHistoryResult, ToolDataRecord } from '../types';

/**
 * Interface for tool history handlers
 * Each handler is responsible for undo/redo operations of specific tool types
 */
export interface IToolHistoryHandler {
  /**
   * List of tool names this handler supports
   */
  readonly supportedTools: string[];

  /**
   * Undo a tool execution
   * @param toolName - Name of the tool to undo
   * @param data - Tool execution result data
   * @param workspacePath - Workspace root path
   */
  undo(
    toolName: string,
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult>;

  /**
   * Redo a tool execution
   * @param toolName - Name of the tool to redo
   * @param data - Tool execution result data
   * @param workspacePath - Workspace root path
   */
  redo(
    toolName: string,
    data: ToolDataRecord,
    workspacePath: string
  ): Promise<ToolHistoryResult>;
}