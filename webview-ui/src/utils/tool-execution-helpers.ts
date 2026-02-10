import type { ToolExecutor } from '../lib/tool-executor';
import type { ParsedToolBlock } from '../types/tool';
import type { ToolProgress } from '../lib/tool-utils';
import type { ImageAttachment } from '../types/chat';

/**
 * Progress callback for tools that support streaming progress (run_terminal)
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

  // Special-case: if read_file returned an image payload, do NOT stringify the full dataUrl.
  // The image should be forwarded as a multimodal attachment instead.
  if (toolName === 'read_file' && data?.kind === 'image') {
    const p = data.path as string | undefined;
    const mimeType = data.mimeType as string | undefined;
    const byteLength = data.byteLength as number | undefined;
    const kb = typeof byteLength === 'number' ? `${Math.round(byteLength / 1024)}KB` : '';
    return `[read_file] ${p ?? '(image)'} → IMAGE${mimeType ? ` (${mimeType}${kb ? ` ${kb}` : ''})` : ''}`;
  }

  switch (toolName) {
    case 'edit': {
      const path = data?.path as string;
      const action = data?.action as string | undefined;
      return `[edit] ${path} → ${action === 'no_change' ? 'NO CHANGES' : 'APPLIED'}`;
    }

    case 'write_to_file': {
      const path = data?.path as string;
      const action = data?.action as string;
      return `[write_to_file] ${path} → ${action === 'created' ? 'CREATED' : action === 'no_change' ? 'NO CHANGES' : 'MODIFIED'}`;
    }

    case 'delete': {
      const path = data?.path as string;
      return `[delete] ${path} → DELETED`;
    }

    case 'todo_write': {
      const tasks = data?.tasks as Array<{ status: string }> | undefined;
      const allCompleted = data?.allCompleted === true;
      const total = tasks?.length ?? 0;
      const completed = tasks?.filter(t => t.status === 'completed').length ?? 0;
      if (allCompleted) {
        return `[todo_write] All ${total} tasks completed. ALL TASKS DONE — give a brief final summary and STOP. Do not call any more tools.`;
      }
      return `[todo_write] ${completed}/${total} tasks completed`;
    }

    default:
      // Other tools (read_file, grep_search, etc.) keep detailed output
      return `Tool: ${toolName}\nResult: ${JSON.stringify(result.data, null, 2)}`;
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return null;
  }
  return { mimeType: match[1], base64: match[2] };
}

export function extractImageAttachmentsFromToolResult(
  toolName: string,
  result: { success: boolean; data?: unknown; error?: string }
): ImageAttachment[] {
  if (!result.success) {
    return [];
  }

  if (toolName !== 'read_file' || !result.data || typeof result.data !== 'object') {
    return [];
  }

  const data = result.data as { kind?: unknown; dataUrl?: unknown; mimeType?: unknown; byteLength?: unknown; path?: unknown };
  if (data.kind !== 'image' || typeof data.dataUrl !== 'string') {
    return [];
  }

  const parsed = parseDataUrl(data.dataUrl);
  if (!parsed) {
    return [];
  }

  const size = typeof data.byteLength === 'number' ? data.byteLength : 0;
  const name = typeof data.path === 'string' ? data.path.split('/').pop() : undefined;

  return [
    {
      data: parsed.base64,
      mimeType: (typeof data.mimeType === 'string' ? data.mimeType : parsed.mimeType),
      size,
      name,
    }
  ];
}

interface ToolExecutionResult {
  executedToolCalls: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
    status: 'completed' | 'error' | 'aborted' | 'rejected';
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
      onProgress
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
    // Check for user rejection (case-insensitive to be safe)
    const isRejected = !toolResult.success && (
      toolResult.error?.includes('REJECTED_BY_USER') || 
      toolResult.error?.toLowerCase().includes('rejected by user')
    );
    
    const status = toolResult.success 
      ? ('completed' as const) 
      : isRejected 
        ? ('rejected' as const) 
        : ('error' as const);

    return {
      executedToolCalls: [
        {
          toolName: toolBlock.toolName,
          parameters: toolBlock.parameters,
          status,
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

    // Check if this is a rejection error caught as an exception
    const isRejected = errorMessage.includes('REJECTED_BY_USER') || 
                       errorMessage.toLowerCase().includes('rejected by user');
    
    const status = isRejected ? ('rejected' as const) : ('error' as const);
    
    return {
      executedToolCalls: [
        {
          toolName: toolBlock.toolName,
          parameters: toolBlock.parameters,
          status,
          result: { success: false, error: errorMessage },
        },
      ],
      toolResults: [`Tool: ${toolBlock.toolName}\nError: ${errorMessage}`],
      wasStopped: false,
    };
  }
}
