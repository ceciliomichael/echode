/**
 * Types for continuation history building
 */

/**
 * Represents a todo item in the task list
 */
export interface TodoItem {
  id: string;
  content: string;
  status: string;
}

/**
 * Configuration for context management
 */
export interface ContinuationConfig {
  maxHistoryMessages: number;
  maxDiagnosticsChars: number;
  messagesToAlwaysKeep: number;
}

/**
 * Options for building tool result messages
 */
export interface ToolResultMessageOptions {
  toolResultText: string;
  diagnosticsText: string;
  summaryPrefix?: string;
}

/**
 * Result of message truncation operation
 */
export interface TruncationResult {
  messages: import('../../types/chat').Message[];
  wasTruncated: boolean;
}