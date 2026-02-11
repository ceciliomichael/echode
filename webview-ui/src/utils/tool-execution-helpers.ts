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
 * while preserving detailed output for search/read tools that need their data.
 * 
 * @param staleFilePaths - Optional set of file paths whose reads are stale
 *   (file was edited/written later in the same turn). When provided, read_file
 *   results for these paths show a condensed "OUTDATED" message instead of full content.
 */
export function formatToolResultForAI(
  toolName: string,
  result: { success: boolean; data?: unknown; error?: string },
  staleFilePaths?: Set<string>
): string {
  if (!result.success) {
    const msg = result.error || 'Unknown error';
    return `[${toolName} ERROR] ${msg}`;
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
    case 'read_file': {
      const path = data?.path as string | undefined;
      const content = data?.content as string | undefined;
      const totalLines = data?.totalLines as number | undefined;
      const startLine = data?.startLine as number | undefined;
      const endLine = data?.endLine as number | undefined;

      // Check if this read is stale (file was edited/written later in the same turn)
      if (path && staleFilePaths?.has(path)) {
        return `[read_file] ${path} (OUTDATED - file was modified after this read)\n[Content hidden - the edit/write result above shows the current file state]`;
      }

      if (!path || !content) {
        return `Tool: read_file\nResult: ${JSON.stringify(data, null, 2)}`;
      }

      const rangeInfo = (startLine && endLine && totalLines && (startLine !== 1 || endLine !== totalLines))
        ? ` [lines ${startLine}-${endLine}]`
        : '';
      const lineInfo = totalLines ? ` (${totalLines} lines)` : '';

      return `[read_file] ${path}${lineInfo}${rangeInfo}\n┌─ FILE CONTENT (use for edit old_string) ─┐\n${content}\n└─ END ${path} ─┘`;
    }

    case 'edit': {
      const path = data?.path as string;
      const action = data?.action as string | undefined;
      const reason = data?.reason as string | undefined;

      if (action === 'no_change') {
        if (reason === 'old_string_equals_new_string') {
          return `[edit] ${path} → NO CHANGES (old_string and new_string are identical — file already has the desired content, move on)`;
        }
        return `[edit] ${path} → NO CHANGES`;
      }

      let out = `[edit] ${path} → APPLIED (edit verified, change is now in the file)`;

      const oldContent = data?.oldContent as string | undefined;
      const newContent = data?.newContent as string | undefined;
      if (oldContent && newContent) {
        const oldLines = oldContent.replace(/\r\n/g, '\n').split('\n');
        const newLines = newContent.replace(/\r\n/g, '\n').split('\n');

        let firstDiff = 0;
        for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
          if (oldLines[i] !== newLines[i]) { firstDiff = i; break; }
        }

        let lastDiff = newLines.length - 1;
        for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
          if (oldLines[oldLines.length - 1 - i] !== newLines[newLines.length - 1 - i]) {
            lastDiff = newLines.length - 1 - i;
            break;
          }
        }

        const pad = 5;
        const start = Math.max(0, firstDiff - pad);
        let end = Math.min(newLines.length, lastDiff + pad + 1);

        const maxLines = 50;
        if (end - start > maxLines) {
          end = Math.min(newLines.length, start + maxLines);
        }

        const window = newLines
          .slice(start, end)
          .map((l, i) => `${start + i + 1} | ${l}`)
          .join('\n');

        out += `\n[current file state around edit, lines ${start + 1}-${end} of ${newLines.length}]\n${window}`;
      }

      return out;
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
