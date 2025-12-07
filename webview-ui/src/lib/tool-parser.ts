import type { ToolCall, ParsedToolBlock } from '../types/tool';
import {
  extractFunctionCallsBlocks,
  extractInvokeBlocks,
  parseXMLParameters,
  preprocessContent,
  findMatchingClosingTag,
  findMatchingInvokeClosingTag,
  isInsideInvokeParameterValue,
} from './parser';

// Legacy regex pattern kept for parseToolBlock backward compatibility
const TOOL_BLOCK_REGEX = /<function_calls>([\s\S]*?)<\/function_calls>/;

/**
 * Parse a single invoke block and return structured data
 * Extracts tool name from invoke tag attribute: <invoke name="TOOL_NAME">
 * Note: Nested tool-call XML inside parameter values is now handled correctly
 * by balanced tag matching in parseXMLParameters, so we no longer reject them.
 */
function parseInvokeBlock(
  invokeContent: string,
  toolName: string,
  rawContent: string,
): ParsedToolBlock | null {
  try {
    // Parse XML-style parameters from the invoke content
    // Balanced tag matching ensures nested </parameter> tags don't break parsing
    const parameters = parseXMLParameters(invokeContent);

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
 * Parse function_calls block and extract all invoke blocks
 * Returns array of parsed tool blocks
 * Uses balanced tag matching to handle nested content properly
 */
function parseFunctionCallsBlock(
  contentStr: string,
  rawContent: string,
): ParsedToolBlock[] {
  const toolBlocks: ParsedToolBlock[] = [];

  // Use balanced tag extraction instead of regex
  const invokeBlocks = extractInvokeBlocks(contentStr);

  for (const block of invokeBlocks) {
    if (block.toolName && typeof block.toolName === 'string') {
      const parsed = parseInvokeBlock(block.innerContent, block.toolName, rawContent);
      if (parsed) {
        toolBlocks.push(parsed);
      }
    }
  }

  return toolBlocks;
}

/**
 * Extracts tool calls from XML-style tool blocks
 * Format: <function_calls><invoke name="TOOL_NAME"><parameter name="param">value</parameter></invoke></function_calls>
 */
export function parseToolBlock(content: string): ParsedToolBlock | null {
  const match = content.match(new RegExp(`^${TOOL_BLOCK_REGEX.source}$`, 'm'));

  if (!match) {
    return null;
  }

  const innerContent = match[1];
  const toolBlocks = parseFunctionCallsBlock(innerContent, match[0]);

  // Return the first tool block (for single tool call compatibility)
  // Allow all tool names to pass through - validation happens at execution time
  return toolBlocks.length > 0 ? toolBlocks[0] : null;
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

  const preprocessed = preprocessContent(content);
  const toolBlocks = extractToolBlocks(preprocessed);

  return toolBlocks.length > 0;
}

/**
 * Trims content to only include up to the end of the last complete tool block
 * Uses balanced tag matching for proper nested content handling
 */
export function trimToLastCompleteToolBlock(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  const preprocessed = preprocessContent(content);
  const functionCallsBlocks = extractFunctionCallsBlocks(preprocessed);

  if (functionCallsBlocks.length === 0) {
    return content;
  }

  // Get the last valid tool block from preprocessed content
  let lastValidBlock: { endIndex: number } | null = null;

  for (const block of functionCallsBlocks) {
    const parsedBlocks = parseFunctionCallsBlock(block.innerContent, block.fullMatch);
    if (parsedBlocks.length > 0) {
      lastValidBlock = block;
    }
  }

  if (lastValidBlock) {
    // Find the end of the last thinking block in original content
    let searchStart = 0;
    for (const tag of ['</thinking>', '</think>']) {
      const idx = content.lastIndexOf(tag);
      if (idx !== -1 && idx + tag.length > searchStart) {
        searchStart = idx + tag.length;
      }
    }

    // Find all function_calls blocks AFTER thinking blocks in original content
    // Use balanced matching to handle nested function_calls inside parameter values
    const openTag = '<function_calls>';
    const closingTag = '</function_calls>';
    let lastClosePos = -1;
    let searchPos = searchStart;

    while (searchPos < content.length) {
      const openPos = content.indexOf(openTag, searchPos);
      if (openPos === -1) break;

      const openTagEnd = openPos + openTag.length;
      const closePos = findMatchingClosingTag(content, openTagEnd, openTag, closingTag);
      if (closePos === -1) break;

      lastClosePos = closePos + closingTag.length;
      searchPos = lastClosePos;
    }

    if (lastClosePos !== -1) {
      return content.slice(0, lastClosePos);
    }
  }

  return content;
}

/**
 * Trims content to only include up to the end of the FIRST complete tool block
 * Useful for incremental tool execution
 * Uses balanced tag matching for proper nested content handling
 */
export function trimToFirstCompleteToolBlock(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  const preprocessed = preprocessContent(content);
  const functionCallsBlocks = extractFunctionCallsBlocks(preprocessed);

  for (const block of functionCallsBlocks) {
    const parsedBlocks = parseFunctionCallsBlock(block.innerContent, block.fullMatch);
    if (parsedBlocks.length > 0) {
      // Found a valid tool block in preprocessed content
      // Find where this block's closing tag appears in original content
      // We need to find it AFTER any thinking blocks
      const closingTag = '</function_calls>';
      
      // Find the end of the last thinking block in original content
      let searchStart = 0;
      const thinkEndMatch = content.match(/<\/thinking>|<\/think>/g);
      if (thinkEndMatch) {
        // Find the last occurrence
        let lastThinkEnd = -1;
        for (const tag of ['</thinking>', '</think>']) {
          const idx = content.lastIndexOf(tag);
          if (idx > lastThinkEnd) {
            lastThinkEnd = idx + tag.length;
          }
        }
        if (lastThinkEnd > 0) {
          searchStart = lastThinkEnd;
        }
      }
      
      // Find the closing tag of the first real function_calls after thinking
      const openTagAfterThink = content.indexOf('<function_calls>', searchStart);
      if (openTagAfterThink !== -1) {
        // Use balanced tag matching to find the correct closing tag
        const openTagEnd = openTagAfterThink + '<function_calls>'.length;
        const closePos = findMatchingClosingTag(content, openTagEnd, '<function_calls>', closingTag);
        if (closePos !== -1) {
          return content.slice(0, closePos + closingTag.length);
        }
      }
      break;
    }
  }

  return content;
}

/**
 * Extracts all complete tool blocks from content
 * Excludes tool blocks that are inside <think> or <thinking> tags
 * Uses balanced tag matching to handle nested content (e.g., HTML with </script>)
 */
export function extractToolBlocks(content: string): ParsedToolBlock[] {
  const preprocessed = preprocessContent(content);
  const toolBlocks: ParsedToolBlock[] = [];

  // Use balanced tag extraction instead of regex for proper nested content handling
  const functionCallsBlocks = extractFunctionCallsBlocks(preprocessed);
  console.log(`[ToolParser] extractToolBlocks: found ${functionCallsBlocks.length} function_calls blocks`);

  for (const block of functionCallsBlocks) {
    console.log(`[ToolParser] Processing block at ${block.startIndex}-${block.endIndex}, innerContent length: ${block.innerContent.length}`);
    const parsedBlocks = parseFunctionCallsBlock(block.innerContent, block.fullMatch);
    console.log(`[ToolParser] Parsed ${parsedBlocks.length} invoke blocks from this function_calls`);

    // Add all parsed invoke blocks
    toolBlocks.push(...parsedBlocks);
  }

  console.log(`[ToolParser] extractToolBlocks returning ${toolBlocks.length} total blocks`);
  return toolBlocks;
}

/**
 * Extract the first tool block from content
 */
export function extractFirstToolBlock(content: string): ParsedToolBlock | null {
  const blocks = extractToolBlocks(content);
  return blocks.length > 0 ? blocks[0] : null;
}

/**
 * Check if a tool is parallelizable.
 * By default, tools are treated as parallelizable unless explicitly marked as serial-only.
 * Serial-only tools include planning/todo helpers and destructive operations.
 */
export function isParallelizableTool(toolName: string): boolean {
  const serialOnlyTools = new Set<string>([
    'todo_write',
    'todo_read',
    'plan_navigator',
    'plan_handoff',
    'delete_file',
    'execute_command',
  ]);
  return !serialOnlyTools.has(toolName);
}

/**
 * Represents a pending (partial) invoke block where <invoke> opened but </invoke> hasn't arrived
 */
export interface PendingInvokeBlock {
  toolName: string;
  parameters: Record<string, unknown>;
}

/**
 * Extract complete invoke blocks from content that may have an incomplete function_calls block.
 * This is used for incremental tool execution - we can start executing tools as soon as
 * their </invoke> closes, even before </function_calls> is received.
 * 
 * Also returns pending invoke blocks (where <invoke> opened but </invoke> hasn't arrived yet)
 * so the UI can show them as "pending" with streaming content.
 * 
 * Returns: { blocks: ParsedToolBlock[], pendingBlocks: PendingInvokeBlock[], hasFunctionCallsClose: boolean }
 */
export function extractCompleteInvokeBlocksIncremental(content: string): {
  blocks: ParsedToolBlock[];
  pendingBlocks: PendingInvokeBlock[];
  hasFunctionCallsClose: boolean;
} {
  const preprocessed = preprocessContent(content);
  const blocks: ParsedToolBlock[] = [];
  const pendingBlocks: PendingInvokeBlock[] = [];
  
  // Check if we have a function_calls opening
  const openTag = '<function_calls>';
  const closeTag = '</function_calls>';
  
  // Find the end of the last thinking block
  let searchStart = 0;
  for (const tag of ['</thinking>', '</think>']) {
    const idx = preprocessed.lastIndexOf(tag);
    if (idx !== -1 && idx + tag.length > searchStart) {
      searchStart = idx + tag.length;
    }
  }
  
  const openPos = preprocessed.indexOf(openTag, searchStart);
  if (openPos === -1) {
    return { blocks: [], pendingBlocks: [], hasFunctionCallsClose: false };
  }
  
  const openTagEnd = openPos + openTag.length;
  
  // Check if function_calls is closed
  const closePos = findMatchingClosingTag(preprocessed, openTagEnd, openTag, closeTag);
  const hasFunctionCallsClose = closePos !== -1;
  
  // Extract the content inside function_calls (complete or partial)
  const innerContent = hasFunctionCallsClose 
    ? preprocessed.slice(openTagEnd, closePos)
    : preprocessed.slice(openTagEnd);
  
  // Extract all complete invoke blocks from this content
  const invokeBlocks = extractInvokeBlocks(innerContent);
  
  for (const block of invokeBlocks) {
    if (block.toolName && typeof block.toolName === 'string') {
      const parsed = parseInvokeBlockInternal(block.innerContent, block.toolName, block.fullMatch);
      if (parsed) {
        blocks.push(parsed);
      }
    }
  }
  
  // Find pending (partial) invoke blocks - where <invoke> opened but </invoke> hasn't arrived
  // Search for invoke opening tags that don't have a matching close
  const invokeOpenRegex = /<invoke\s+name=["']([^"']+)["']>/g;
  let match: RegExpExecArray | null;
  let lastCompleteInvokeEnd = 0;
  
  // Find where the last complete invoke ends
  if (invokeBlocks.length > 0) {
    const lastBlock = invokeBlocks[invokeBlocks.length - 1];
    const lastBlockPos = innerContent.lastIndexOf(lastBlock.fullMatch);
    if (lastBlockPos !== -1) {
      lastCompleteInvokeEnd = lastBlockPos + lastBlock.fullMatch.length;
    }
  }
  
  // Search for invoke openings after the last complete block
  invokeOpenRegex.lastIndex = lastCompleteInvokeEnd;
  while ((match = invokeOpenRegex.exec(innerContent)) !== null) {
    // Skip if inside parameter value
    if (isInsideInvokeParameterValue(innerContent, match.index)) {
      continue;
    }
    
    const toolName = match[1];
    const openTagEndPos = match.index + match[0].length;
    
    // Check if this invoke has a closing tag
    const invokeClosePos = findMatchingInvokeClosingTag(innerContent, openTagEndPos);
    
    if (invokeClosePos === -1) {
      // This is a pending invoke - no closing tag yet
      const partialContent = innerContent.slice(openTagEndPos);
      const parameters = parseXMLParameters(partialContent);
      
      pendingBlocks.push({
        toolName,
        parameters,
      });
    }
  }
  
  return { blocks, pendingBlocks, hasFunctionCallsClose };
}

/**
 * Internal helper to parse invoke block (same as parseInvokeBlock but exported for reuse)
 */
function parseInvokeBlockInternal(
  invokeContent: string,
  toolName: string,
  rawContent: string,
): ParsedToolBlock | null {
  try {
    const parameters = parseXMLParameters(invokeContent);
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
 * Extract parallelizable tool blocks starting from a given tool index
 * Finds the function_calls block that contains the tool at startingToolIndex
 * and returns all parallelizable tools from that block.
 */
export function extractParallelizableToolBlocks(content: string, startingToolIndex: number = 0): ParsedToolBlock[] {
  const preprocessed = preprocessContent(content);
  
  // Get all function_calls blocks
  const functionCallsBlocks = extractFunctionCallsBlocks(preprocessed);
  console.log(`[ToolParser] extractParallelizableToolBlocks: found ${functionCallsBlocks.length} function_calls blocks, startingToolIndex=${startingToolIndex}`);
  
  if (functionCallsBlocks.length === 0) {
    return [];
  }

  // Find the function_calls block that contains the tool at startingToolIndex
  let currentToolIndex = 0;
  let targetBlock: typeof functionCallsBlocks[0] | null = null;
  let blockStartIndex = 0;
  
  for (const block of functionCallsBlocks) {
    const parsedBlocks = parseFunctionCallsBlock(block.innerContent, block.fullMatch);
    const blockEndIndex = currentToolIndex + parsedBlocks.length;
    
    if (startingToolIndex >= currentToolIndex && startingToolIndex < blockEndIndex) {
      targetBlock = block;
      blockStartIndex = currentToolIndex;
      break;
    }
    
    currentToolIndex = blockEndIndex;
  }
  
  if (!targetBlock) {
    console.log(`[ToolParser] No block found containing toolIndex ${startingToolIndex}`);
    return [];
  }

  console.log(`[ToolParser] Found block at index ${blockStartIndex} containing toolIndex ${startingToolIndex}`);
  
  const parsedBlocks = parseFunctionCallsBlock(targetBlock.innerContent, targetBlock.fullMatch);
  console.log(`[ToolParser] Parsed ${parsedBlocks.length} invoke blocks from function_calls`);
  
  if (parsedBlocks.length === 0) {
    return [];
  }

  // Get only the blocks starting from the relative position within this function_calls block
  const relativeStartIndex = startingToolIndex - blockStartIndex;
  const blocksFromStart = parsedBlocks.slice(relativeStartIndex);
  
  if (blocksFromStart.length === 0) {
    return [];
  }

  // Log each parsed block
  blocksFromStart.forEach((block, idx) => {
    console.log(`[ToolParser] Block ${idx}: ${block.toolName}, parallelizable: ${isParallelizableTool(block.toolName)}`);
  });

  // Check if ALL remaining tools in this function_calls block are parallelizable
  const allParallelizable = blocksFromStart.every(block => isParallelizableTool(block.toolName));
  
  if (!allParallelizable) {
    // If any tool is not parallelizable, only return the first tool for sequential execution
    console.log(`[ToolParser] Not all tools parallelizable, returning only first`);
    return [blocksFromStart[0]];
  }

  // All tools are parallelizable - return all for parallel execution
  console.log(`[ToolParser] All ${blocksFromStart.length} tools are parallelizable, returning all for parallel execution`);
  return blocksFromStart;
}
