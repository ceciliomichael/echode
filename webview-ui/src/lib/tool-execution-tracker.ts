import type { ToolExecutionState, ToolStatus } from '../types/tool';

/**
 * Generate unique tool execution ID based on message ID and tool index
 */
export function generateToolExecutionId(messageId: string, toolIndex: number): string {
  return `${messageId}-tool-${toolIndex}`;
}

/**
 * Create initial tool execution state
 */
export function createToolExecutionState(
  toolExecutionId: string,
  toolName: string,
  parameters: Record<string, unknown>
): ToolExecutionState {
  return {
    toolExecutionId,
    toolName,
    parameters,
    status: 'executing',
    startedAt: Date.now(),
  };
}

/**
 * Update tool execution status
 */
export function updateToolExecutionStatus(
  state: ToolExecutionState,
  status: ToolStatus,
  result?: { success: boolean; data?: unknown; error?: string }
): ToolExecutionState {
  return {
    ...state,
    status,
    result,
    completedAt: status === 'completed' || status === 'error' || status === 'aborted' || status === 'rejected'
      ? Date.now() 
      : state.completedAt,
  };
}

/**
 * Update tool execution progress
 */
export function updateToolExecutionProgress(
  state: ToolExecutionState,
  progress: string
): ToolExecutionState {
  // If both are strings, append (for terminal streaming)
  if (typeof progress === 'string' && typeof state.progress === 'string') {
    return {
      ...state,
      progress: state.progress + progress,
    };
  }

  // Otherwise replace (first chunk, or object update)
  return {
    ...state,
    progress,
  };
}
