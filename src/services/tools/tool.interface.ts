export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ITool {
  name: string;
  execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult>;
}
