/**
 * Tool execution types for the backend
 * Mirrors webview-ui/src/types/tool.ts for backend use
 */

export type ToolStatus = 'pending' | 'executing' | 'completed' | 'error' | 'aborted' | 'fetching_diagnostics';

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolExecutionState {
  toolExecutionId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  status: ToolStatus;
  result?: ToolExecutionResult;
  startedAt: number;
  completedAt?: number;
}
