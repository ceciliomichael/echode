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
 * Note: 'yolo' mode is fully autonomous - plan tools auto-verify without waiting for user
 * Note: 'manual' mode requires explicit user approval for every file change
 */
export type ChatMode = 'agent' | 'plan' | 'ask' | 'general' | 'review' | 'yolo' | 'manual' | 'chat';

/**
 * Diff information for file-modifying tools
 */
export interface ToolConfirmationDiff {
    oldContent: string | null;
    newContent: string;
    fileName: string;
}

/**
 * Confirmation data returned by prepareExecution for Manual Mode approval
 */
export interface ToolConfirmation {
    /** Tool name being executed */
    toolName: string;
    /** Human-readable title for the approval dialog */
    title: string;
    /** Description of what the tool will do */
    message: string;
    /** Diff information for file-modifying tools */
    diff?: ToolConfirmationDiff;
    /** Command string for terminal tools */
    command?: string;
    /** Original parameters passed to the tool */
    parameters: Record<string, unknown>;
}

export interface ITool {
    name: string;
    execute(
        parameters: Record<string, unknown>,
        onProgress?: ToolProgressCallback,
        signal?: AbortSignal,
        mode?: ChatMode
    ): Promise<ToolExecutionResult>;
    
    /**
     * Optional method for Manual Mode: prepare execution and return confirmation data.
     * If implemented, this is called before execute() in manual mode to show the user
     * what changes will be made and request approval.
     */
    prepareExecution?(
        parameters: Record<string, unknown>
    ): Promise<ToolConfirmation | undefined>;
}
