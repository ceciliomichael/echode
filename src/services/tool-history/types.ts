/**
 * Shared types for tool history operations
 */

/**
 * Result of a tool history operation (undo/redo)
 */
export interface ToolHistoryResult {
  success: boolean;
  error?: string;
}

/**
 * Generic data record from tool execution result
 */
export type ToolDataRecord = Record<string, unknown>;