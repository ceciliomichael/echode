import type { ToolCall, ParsedToolBlock } from '../types/tool';

/**
 * Centralized regex pattern for tool blocks
 * Format: ```tool:TOOL_NAME\n{json parameters}\n```
 * 
 * Pattern breakdown:
 * - ```tool:([\w:.-]+) - Opening fence with tool name
 * - \s*\n - Optional whitespace and newline after opening
 * - ([\s\S]*?) - Non-greedy content capture (tool parameters)
 * - \n\s*``` - Newline followed by optional whitespace and closing backticks
 */
const TOOL_BLOCK_REGEX = /```tool:([\w:.-]+)\s*\n([\s\S]*?)\n\s*```/;
const TOOL_BLOCK_REGEX_GLOBAL = /```tool:([\w:.-]+)\s*\n([\s\S]*?)\n\s*```/g;

/**
 * Parse a single tool block and return structured data
 */
function parseToolBlockInternal(
  toolName: string,
  parametersStr: string,
  rawContent: string,
): ParsedToolBlock | null {
  try {
    const parameters = parametersStr.trim()
      ? JSON.parse(parametersStr.trim())
      : {};

    return {
      type: 'tool',
      toolName,
      parameters,
      rawContent,
    };
  } catch {
    return null;
  }
}

/**
 * Extracts tool calls from markdown-style tool blocks
 * Format: ```tool:TOOL_NAME\n{json parameters}\n```
 */
export function parseToolBlock(content: string): ParsedToolBlock | null {
  const match = content.match(new RegExp(`^${TOOL_BLOCK_REGEX.source}$`, 'm'));

  if (!match) {
    return null;
  }

  return parseToolBlockInternal(match[1], match[2], match[0]);
}

/**
 * Creates a ToolCall object from parsed tool block
 */
export function createToolCall(parsed: ParsedToolBlock): ToolCall {
  return {
    toolName: parsed.toolName,
    parameters: parsed.parameters,
    status: 'pending',
  };
}

/**
 * Checks if content contains a complete tool block
 */
export function hasCompleteToolBlock(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Remove <think> blocks before checking for tool blocks
  const contentWithoutThinkBlocks = content.replace(
    /<think>[\s\S]*?<\/think>/g,
    '',
  );

  // Use extractToolBlocks to ensure we can actually parse complete tool blocks
  const toolBlocks = extractToolBlocks(contentWithoutThinkBlocks);

  return toolBlocks.length > 0;
}

/**
 * Trims content to only include up to the end of the last complete tool block
 */
export function trimToLastCompleteToolBlock(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Remove <think> blocks before processing
  const contentWithoutThinkBlocks = content.replace(
    /<think>[\s\S]*?<\/think>/g,
    '',
  );

  // Find all complete tool blocks
  const toolBlocks = extractToolBlocks(contentWithoutThinkBlocks);

  if (toolBlocks.length === 0) {
    return content;
  }

  // Find the position of the end of the last complete tool block
  let lastToolBlockEnd = -1;
  const regex = new RegExp(TOOL_BLOCK_REGEX_GLOBAL.source, 'g');
  let match: RegExpExecArray | null;

  regex.lastIndex = 0;
  match = regex.exec(contentWithoutThinkBlocks);
  while (match !== null) {
    lastToolBlockEnd = match.index + match[0].length;
    match = regex.exec(contentWithoutThinkBlocks);
  }

  if (lastToolBlockEnd > 0) {
    // Find the last tool block in the original content
    const originalMatches: Array<{ index: number; length: number }> = [];
    const originalRegex = new RegExp(TOOL_BLOCK_REGEX_GLOBAL.source, 'g');
    let originalMatch: RegExpExecArray | null;

    originalRegex.lastIndex = 0;
    originalMatch = originalRegex.exec(content);
    while (originalMatch !== null) {
      originalMatches.push({
        index: originalMatch.index,
        length: originalMatch[0].length,
      });
      originalMatch = originalRegex.exec(content);
    }

    if (originalMatches.length > 0) {
      const lastMatch = originalMatches[originalMatches.length - 1];
      return content.slice(0, lastMatch.index + lastMatch.length);
    }
  }

  return content;
}

/**
 * Trims content to only include up to the end of the FIRST complete tool block
 * Useful for incremental tool execution
 */
export function trimToFirstCompleteToolBlock(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Remove <think> blocks before processing
  const contentWithoutThinkBlocks = content.replace(
    /<think>[\s\S]*?<\/think>/g,
    '',
  );

  const match = new RegExp(TOOL_BLOCK_REGEX.source).exec(
    contentWithoutThinkBlocks,
  );
  if (!match) {
    return content;
  }

  // Map the found block back to original content positions
  const originalMatch = new RegExp(TOOL_BLOCK_REGEX.source).exec(content);
  if (originalMatch) {
    return content.slice(0, originalMatch.index + originalMatch[0].length);
  }

  return content;
}

/**
 * Extracts all complete tool blocks from content
 * Excludes tool blocks that are inside <think> tags
 */
export function extractToolBlocks(content: string): ParsedToolBlock[] {
  // Remove all <think>...</think> blocks to prevent tool execution inside them
  const contentWithoutThinkBlocks = content.replace(
    /<think>[\s\S]*?<\/think>/g,
    '',
  );

  const toolBlocks: ParsedToolBlock[] = [];
  let match: RegExpExecArray | null;

  match = TOOL_BLOCK_REGEX_GLOBAL.exec(contentWithoutThinkBlocks);
  while (match !== null) {
    const parsed = parseToolBlockInternal(match[1], match[2], match[0]);
    if (parsed) {
      toolBlocks.push(parsed);
    }
    match = TOOL_BLOCK_REGEX_GLOBAL.exec(contentWithoutThinkBlocks);
  }

  return toolBlocks;
}

/**
 * Extract the first tool block from content
 */
export function extractFirstToolBlock(content: string): ParsedToolBlock | null {
  const blocks = extractToolBlocks(content);
  return blocks.length > 0 ? blocks[0] : null;
}
