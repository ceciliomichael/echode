import type { ToolExecutionState } from '../../../types/tool';
import { REQUEST_BOUNDARY_MARKER } from '../../../utils/think-block-parser';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../../../lib/tool-xml';

/**
 * Internal block tags that should be stripped from user-visible text
 */
const INTERNAL_BLOCK_TAGS = [
  `${TOOL_XML_NAMESPACE}:function_calls`,
  'tool_calling',
  'tool_format',
  'tool_format_critical',
  'available_tools',
  'file_operations',
  'system_reminder',
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

    sanitized = sanitized
      .split(REQUEST_BOUNDARY_MARKER)
      .join('')
      .split('__ECHODE_REQUEST_BOUNDARY__')
      .join('')
      .split('\u001E')
      .join('');

    // Normalize common tool tags (whitespace/casing) so stripping is reliable
    sanitized = sanitized.replace(/<\s*tool\s*:\s*function_calls\s*>/gi, TOOL_FUNCTION_CALLS_OPEN);
    sanitized = sanitized.replace(/<\s*\/\s*tool\s*:\s*function_calls\s*>/gi, TOOL_FUNCTION_CALLS_CLOSE);
    sanitized = sanitized.replace(/<\s*tool\s*:\s*invoke(\s+)/gi, `<${TOOL_XML_NAMESPACE}:invoke$1`);
    sanitized = sanitized.replace(/<\s*\/\s*tool\s*:\s*invoke\s*>/gi, `</${TOOL_XML_NAMESPACE}:invoke>`);
    sanitized = sanitized.replace(/<\s*tool\s*:\s*parameter(\s+)/gi, `<${TOOL_XML_NAMESPACE}:parameter$1`);
    sanitized = sanitized.replace(/<\s*\/\s*tool\s*:\s*parameter\s*>/gi, `</${TOOL_XML_NAMESPACE}:parameter>`);

    for (const tag of INTERNAL_BLOCK_TAGS) {
      const blockRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
      sanitized = sanitized.replace(blockRegex, '');
    }

    // Remove any stray invoke/parameter blocks that might leak into text
    sanitized = sanitized.replace(new RegExp(`<${TOOL_XML_NAMESPACE}:invoke[^>]*>[\\s\\S]*?<\\/${TOOL_XML_NAMESPACE}:invoke>`, 'gi'), '');
    sanitized = sanitized.replace(new RegExp(`<${TOOL_XML_NAMESPACE}:parameter[^>]*>[\\s\\S]*?<\\/${TOOL_XML_NAMESPACE}:parameter>`, 'gi'), '');

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

    return false;
  });
}