import type { ToolExecutionState, EchoSearchProgress } from '../../../types/tool';

/**
 * Internal block tags that should be stripped from user-visible text
 */
const INTERNAL_BLOCK_TAGS = [
  'function_calls',
  'tool_calling',
  'tool_format',
  'tool_format_critical',
  'available_tools',
  'file_operations',
  'system_reminder',
  // Corrupted AI hallucinations - should never display
  'tool_call',
  'tool_code',
];

/**
 * Sanitizes assistant text by removing internal XML blocks that shouldn't be visible to users.
 * Preserves code blocks (```) while stripping internal tags from regular text segments.
 */
export function sanitizeAssistantText(content: string): string {
  if (!content) {
    return content;
  }

  const sanitizeSegment = (segment: string): string => {
    let sanitized = segment;

    // Clean corrupted hybrid tool call formats first
    // Pattern: <tool_call>function_calls> -> remove entirely
    sanitized = sanitized.replace(/<tool_call>function_calls>/gi, '');
    // Pattern: <|tool|> or <|tool_call|> -> remove
    sanitized = sanitized.replace(/<\|tool\|>/gi, '');
    sanitized = sanitized.replace(/<\|tool_call\|>/gi, '');
    sanitized = sanitized.replace(/<\|\/tool\|>/gi, '');
    sanitized = sanitized.replace(/<\|\/tool_call\|>/gi, '');

    for (const tag of INTERNAL_BLOCK_TAGS) {
      const blockRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'g');
      sanitized = sanitized.replace(blockRegex, '');
    }

    // Remove any stray invoke/parameter blocks that might leak into text
    sanitized = sanitized.replace(/<invoke[^>]*>[\s\S]*?<\/invoke>/g, '');
    sanitized = sanitized.replace(/<parameter[^>]*>[\s\S]*?<\/parameter>/g, '');

    return sanitized;
  };

  let result = '';
  let i = 0;

  while (i < content.length) {
    if (content.startsWith('```', i)) {
      const fenceStart = i;
      i += 3;

      while (i < content.length && content[i] !== '\n' && content[i] !== '\r') {
        i++;
      }

      const fenceBodyStart = fenceStart;
      const closePos = content.indexOf('```', i);

      if (closePos === -1) {
        result += content.slice(fenceBodyStart);
        return result;
      }

      const fenceBlockEnd = closePos + 3;
      result += content.slice(fenceBodyStart, fenceBlockEnd);
      i = fenceBlockEnd;
      continue;
    }

    const nextFencePos = content.indexOf('```', i);
    const segmentEnd = nextFencePos === -1 ? content.length : nextFencePos;
    const segment = content.slice(i, segmentEnd);
    result += sanitizeSegment(segment);
    i = segmentEnd;
  }

  return result;
}

/**
 * Deep comparison function for tool executions map.
 * Used by React.memo to prevent unnecessary re-renders.
 */
export function areToolExecutionsEqual(
  prev: Map<string, ToolExecutionState> | undefined,
  next: Map<string, ToolExecutionState> | undefined
): boolean {
  if (prev === next) {
    return true;
  }

  if (prev?.size !== next?.size) {
    return false;
  }

  return Array.from(prev?.entries() || []).every(([key, value]) => {
    const nextValue = next?.get(key);

    // Check basic properties first
    if (nextValue?.status !== value.status || nextValue?.result !== value.result) {
      return false;
    }

    // Compare progress
    const prevProgress = value.progress;
    const nextProgress = nextValue?.progress;

    if (prevProgress === nextProgress) {
      return true;
    }

    // Handle string progress (run_terminal)
    if (typeof prevProgress === 'string' && typeof nextProgress === 'string') {
      return prevProgress === nextProgress;
    }

    // Handle object progress (echo_search)
    if (
      typeof prevProgress === 'object' &&
      typeof nextProgress === 'object' &&
      prevProgress !== null &&
      nextProgress !== null
    ) {
      const p1 = prevProgress as EchoSearchProgress;
      const p2 = nextProgress as EchoSearchProgress;

      const prevTools = p1.tools || [];
      const nextTools = p2.tools || [];
      const toolsEqual =
        prevTools.length === nextTools.length &&
        prevTools.every((tool, i) => tool === nextTools[i]);

      return (
        p1.iteration === p2.iteration &&
        p1.phase === p2.phase &&
        p1.toolsIteration === p2.toolsIteration &&
        p1.message === p2.message &&
        toolsEqual
      );
    }

    return false;
  });
}