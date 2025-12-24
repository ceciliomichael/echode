import type { ToolExecutor } from '../lib/tool-executor';
import type { ParsedToolBlock } from '../types/tool';
import type { ToolProgress } from '../lib/tool-utils';

/**
 * Progress callback for tools that support streaming progress (echo_search, run_terminal)
 */
export type ToolProgressCallback = (progress: ToolProgress) => void;

/**
 * Format tool result for AI context - returns concise message for file modification tools
 * while preserving detailed output for search/read tools that need their data
 */
export function formatToolResultForAI(
  toolName: string,
  result: { success: boolean; data?: unknown; error?: string }
): string {
  if (!result.success) {
    return `Tool: ${toolName}\nError: ${result.error}`;
  }

  const data = result.data as Record<string, unknown> | undefined;

  switch (toolName) {
    case 'apply_diff': {
      const path = data?.path as string;
      const action = data?.action as string | undefined;
      return `[apply_diff] ${path} → ${action === 'no_change' ? 'NO CHANGES' : 'APPLIED'}`;
    }

    case 'write_to_file': {
      const path = data?.path as string;
      const action = data?.action as string;
      return `[write_to_file] ${path} → ${action === 'created' ? 'CREATED' : action === 'no_change' ? 'NO CHANGES' : 'MODIFIED'}`;
    }

    case 'delete_file': {
      const path = data?.path as string;
      return `[delete_file] ${path} → DELETED`;
    }

    default:
      // Other tools (read_file, grep_search, etc.) keep detailed output
      return `Tool: ${toolName}\nResult: ${JSON.stringify(result.data, null, 2)}`;
  }
}

interface ToolExecutionResult {
  executedToolCalls: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
    status: 'completed' | 'error' | 'aborted';
    result: { success: boolean; data?: unknown; error?: string };
  }>;
  toolResults: string[];
  wasStopped: boolean;
}

/**
 * Execute a tool and handle stop conditions
 */
export async function executeToolWithStopCheck(
  toolExecutor: ToolExecutor,
  toolBlock: ParsedToolBlock,
  isStoppingRef: React.MutableRefObject<boolean>,
  onProgress?: ToolProgressCallback,
  signal?: AbortSignal
): Promise<ToolExecutionResult> {
  try {
    const toolResult = await toolExecutor.execute(
      {
        toolName: toolBlock.toolName,
        parameters: toolBlock.parameters,
        status: 'executing',
      },
      signal, // Pass abort signal for cancellation
      undefined, // onStatusChange
      onProgress // progress callback for echo_search
    );

    // Check if stopped during execution or if the result indicates abort
    const isAbortResult = !toolResult.success && (
      isStoppingRef.current ||
      toolResult.error?.toLowerCase().includes('abort') ||
      toolResult.error?.toLowerCase().includes('stopped')
    );

    if (isAbortResult) {
      return {
        executedToolCalls: [
          {
            toolName: toolBlock.toolName,
            parameters: toolBlock.parameters,
            status: 'aborted' as const,
            result: { success: false, error: 'Stopped by user' },
          },
        ],
        toolResults: [],
        wasStopped: true,
      };
    }

    // Normal tool result
    return {
      executedToolCalls: [
        {
          toolName: toolBlock.toolName,
          parameters: toolBlock.parameters,
          status: toolResult.success ? ('completed' as const) : ('error' as const),
          result: toolResult,
        },
      ],
      toolResults: [formatToolResultForAI(toolBlock.toolName, toolResult)],
      wasStopped: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if this is an abort error (from signal abort or user stop)
    const isAbortError = errorMessage.toLowerCase().includes('abort') || 
                         errorMessage.toLowerCase().includes('stopped') ||
                         isStoppingRef.current;
    
    if (isAbortError) {
      return {
        executedToolCalls: [
          {
            toolName: toolBlock.toolName,
            parameters: toolBlock.parameters,
            status: 'aborted' as const,
            result: { success: false, error: 'Stopped by user' },
          },
        ],
        toolResults: [],
        wasStopped: true,
      };
    }
    
    return {
      executedToolCalls: [
        {
          toolName: toolBlock.toolName,
          parameters: toolBlock.parameters,
          status: 'error' as const,
          result: { success: false, error: errorMessage },
        },
      ],
      toolResults: [`Tool: ${toolBlock.toolName}\nError: ${errorMessage}`],
      wasStopped: false,
    };
  }
}
