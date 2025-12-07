import type { ToolExecutor } from '../lib/tool-executor';
import type { ParsedToolBlock, EchoSearchProgress } from '../types/tool';

/**
 * Progress callback for echo_search tool iterations
 */
export type ToolProgressCallback = (progress: EchoSearchProgress) => void;

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
      toolResults: [
        toolResult.success
          ? `Tool: ${toolBlock.toolName}\nResult: ${JSON.stringify(toolResult.data, null, 2)}`
          : `Tool: ${toolBlock.toolName}\nError: ${toolResult.error}`,
      ],
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
