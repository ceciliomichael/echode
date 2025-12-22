export interface ToolExecutionResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

/**
 * Progress callback for tools that support streaming progress updates
 */
export type ToolProgressCallback = (progress: unknown) => void;

/**
 * Chat mode types for mode-specific tool behavior
 */
export type ChatMode = 'agent' | 'plan' | 'ask' | 'general' | 'review';

export interface ITool {
    name: string;
    execute(
        parameters: Record<string, unknown>,
        onProgress?: ToolProgressCallback,
        signal?: AbortSignal,
        mode?: ChatMode
    ): Promise<ToolExecutionResult>;
}
