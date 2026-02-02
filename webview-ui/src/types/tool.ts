/**
 * Tool execution types for echode extension
 */

export type ToolStatus = 'pending' | 'executing' | 'completed' | 'error' | 'aborted' | 'fetching_diagnostics' | 'awaiting_user' | 'rejected';

export interface Tool {
  id: string;
  name: string;
  description: string;
  aiDescription?: string;
  enabled: boolean;
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, unknown>;
  status: ToolStatus;
  result?: ToolExecutionResult;
  toolExecutionId?: string;
  progress?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ParsedToolBlock {
  type: 'tool';
  toolName: string;
  parameters: Record<string, unknown>;
  rawContent: string;
}

export interface ReadFileParameters {
  path?: string;
  startLine?: number;
  endLine?: number;
  files?: Array<{
    path: string;
    line_range?: {
      start?: number;
      end?: number;
    };
  }>;
}

export interface WriteFileParameters {
  path: string;
  content: string;
}

export interface ListFilesParameters {
  path: string;
}

export interface CapturedDiagnostic {
  line: number;
  character: number;
  severity: 'Error' | 'Warning' | 'Information' | 'Hint';
  message: string;
  source?: string;
  code?: string | number;
}

export interface ToolExecutionState {
  toolExecutionId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  status: ToolStatus;
  result?: ToolExecutionResult;
  startedAt: number;
  completedAt?: number;
  diagnosticAttempts?: number;
  diagnostics?: CapturedDiagnostic[];
  isFetchingDiagnostics?: boolean;
  progress?: string;
}
