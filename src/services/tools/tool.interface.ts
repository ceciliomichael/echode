export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Progress callback for tools that support streaming progress updates
 */
export type ToolProgressCallback = (progress: unknown) => void;

export interface ITool {
  name: string;
  execute(parameters: Record<string, unknown>, onProgress?: ToolProgressCallback, signal?: AbortSignal): Promise<ToolExecutionResult>;
}
