import type { ToolCall, ParsedToolBlock } from '../types/tool';
import {
  extractFunctionCallsBlocks,
  extractInvokeBlocks,
  parseXMLParameters,
  preprocessContent,
  findMatchingClosingTag,
  findMatchingInvokeClosingTag,
  isInsideInvokeParameterValue,
  isInsideParameterValue,
} from './parser';

import {
  extractKimiToolCalls,
  extractKimiToolCallsIncremental,
  extractKimiToolCallsSection,
  kimiBlocksToParsedToolBlocks,
  type KimiPendingToolCall,
} from './kimi-parser';

import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from './tool-xml';

function recoverMissingFunctionCallsWrapper(content: string): string {
  let processed = content;

  const escapedNamespace = TOOL_XML_NAMESPACE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Recover missing angle brackets for wrapper markers like "tool:function_calls".
  processed = processed.replace(
    new RegExp(`(^|[\\s>])${escapedNamespace}\\s*:\\s*function_calls(?=\\s|$)`, 'gi'),
    `$1${TOOL_FUNCTION_CALLS_OPEN}`
  );
  processed = processed.replace(
    new RegExp(`(^|[\\s>])\\/\\s*${escapedNamespace}\\s*:\\s*function_calls(?=\\s|$)`, 'gi'),
    `$1${TOOL_FUNCTION_CALLS_CLOSE}`
  );

  // If invoke blocks exist without a function_calls wrapper, wrap the first contiguous invoke sequence.
  if (!processed.includes(TOOL_FUNCTION_CALLS_OPEN)) {
    const invokeOpenRegex = new RegExp(`<\\s*${escapedNamespace}\\s*:\\s*invoke\\b`, 'i');
    const firstInvoke = processed.search(invokeOpenRegex);
    if (firstInvoke !== -1 && (firstInvoke === 0 || processed[firstInvoke - 1] !== '`')) {
      const invokeClose = `</${TOOL_XML_NAMESPACE}:invoke>`;
      const lastInvokeClose = processed.lastIndexOf(invokeClose);
      if (lastInvokeClose !== -1 && lastInvokeClose > firstInvoke) {
        const invokeBlockEnd = lastInvokeClose + invokeClose.length;
        processed =
          processed.slice(0, firstInvoke)
          + TOOL_FUNCTION_CALLS_OPEN
          + processed.slice(firstInvoke, invokeBlockEnd)
          + TOOL_FUNCTION_CALLS_CLOSE
          + processed.slice(invokeBlockEnd);
      }
    }
  }

  return processed;
}

function isInsideThinkBlock(content: string, position: number): boolean {
  const tags = [
    { open: '<think>', close: '</think>' },
    { open: '<thinking>', close: '</thinking>' },
  ];

  const depths = new Map<string, number>();
  for (const tag of tags) {
    depths.set(tag.open, 0);
  }

  let i = 0;
  while (i < position) {
    let nextPos = -1;
    let nextTag: { kind: 'open' | 'close'; open: string; close: string } | null = null;

    for (const tag of tags) {
      const openPos = content.indexOf(tag.open, i);
      if (openPos !== -1 && openPos < position && (nextPos === -1 || openPos < nextPos)) {
        nextPos = openPos;
        nextTag = { kind: 'open', open: tag.open, close: tag.close };
      }

      const closePos = content.indexOf(tag.close, i);
      if (closePos !== -1 && closePos < position && (nextPos === -1 || closePos < nextPos)) {
        nextPos = closePos;
        nextTag = { kind: 'close', open: tag.open, close: tag.close };
      }
    }

    if (nextPos === -1 || !nextTag) {
      break;
    }

    // Ignore tags inside <${TOOL_XML_NAMESPACE}:parameter> values (e.g. edit/write_to_file payloads)
    if (isInsideParameterValue(content, nextPos)) {
      i = nextPos + (nextTag.kind === 'open' ? nextTag.open.length : nextTag.close.length);
      continue;
    }

    // Ignore tags in inline code / backtick contexts
    if (nextPos > 0 && content[nextPos - 1] === '`') {
      i = nextPos + (nextTag.kind === 'open' ? nextTag.open.length : nextTag.close.length);
      continue;
    }

    const key = nextTag.open;
    const currentDepth = depths.get(key) ?? 0;

    if (nextTag.kind === 'open') {
      depths.set(key, currentDepth + 1);
      i = nextPos + nextTag.open.length;
    } else {
      depths.set(key, Math.max(0, currentDepth - 1));
      i = nextPos + nextTag.close.length;
    }
  }

  for (const depth of depths.values()) {
    if (depth > 0) {
      return true;
    }
  }
  return false;
}

// Legacy regex pattern kept for parseToolBlock backward compatibility
const TOOL_BLOCK_REGEX = new RegExp(
  `<${TOOL_XML_NAMESPACE}:function_calls>([\\s\\S]*?)<\\/${TOOL_XML_NAMESPACE}:function_calls>`
);

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

  const kimiSection = extractKimiToolCallsSection(content, 0);
  if (kimiSection?.hasSectionEnd) {
    return content.slice(0, kimiSection.sectionEnd);
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
    const searchStart = 0;

    // Find all function_calls blocks AFTER thinking blocks in original content
    // Use balanced matching to handle nested function_calls inside parameter values
    const openTag = TOOL_FUNCTION_CALLS_OPEN;
    const closingTag = TOOL_FUNCTION_CALLS_CLOSE;
    const parserFlags = (globalThis as unknown as {
      __ECHODE_TOOL_PARSER_FLAGS__?: { skipBacktickTools?: boolean };
    }).__ECHODE_TOOL_PARSER_FLAGS__;
    let lastClosePos = -1;
    let searchPos = searchStart;

    while (searchPos < content.length) {
      const openPos = content.indexOf(openTag, searchPos);
      if (openPos === -1) { break; }

      if (parserFlags?.skipBacktickTools && openPos > 0 && content[openPos - 1] === '`') {
        searchPos = openPos + openTag.length;
        continue;
      }

      if (isInsideParameterValue(content, openPos)) {
        searchPos = openPos + openTag.length;
        continue;
      }

      const openTagEnd = openPos + openTag.length;
      const closePos = findMatchingClosingTag(content, openTagEnd, openTag, closingTag);
      if (closePos === -1) { break; }

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

  const kimiSection = extractKimiToolCallsSection(content, 0);
  if (kimiSection?.hasSectionEnd) {
    return content.slice(0, kimiSection.sectionEnd);
  }

  const preprocessed = preprocessContent(content);
  const functionCallsBlocks = extractFunctionCallsBlocks(preprocessed);

  for (const block of functionCallsBlocks) {
    const parsedBlocks = parseFunctionCallsBlock(block.innerContent, block.fullMatch);
    if (parsedBlocks.length > 0) {
      // Found a valid tool block in preprocessed content
      // Find where this block's closing tag appears in original content
      // We need to find it AFTER any LEADING think block
      const closingTag = TOOL_FUNCTION_CALLS_CLOSE;
      const parserFlags = (globalThis as unknown as {
        __ECHODE_TOOL_PARSER_FLAGS__?: { skipBacktickTools?: boolean };
      }).__ECHODE_TOOL_PARSER_FLAGS__;

      const searchStart = 0;

      // Find the closing tag of the first real function_calls after thinking
      let openTagAfterThink = searchStart;
      while (openTagAfterThink < content.length) {
        const nextOpen = content.indexOf(TOOL_FUNCTION_CALLS_OPEN, openTagAfterThink);
        if (nextOpen === -1) {
          openTagAfterThink = -1;
          break;
        }
        if (parserFlags?.skipBacktickTools && nextOpen > 0 && content[nextOpen - 1] === '`') {
          openTagAfterThink = nextOpen + TOOL_FUNCTION_CALLS_OPEN.length;
          continue;
        }
        if (isInsideParameterValue(content, nextOpen)) {
          openTagAfterThink = nextOpen + TOOL_FUNCTION_CALLS_OPEN.length;
          continue;
        }
        openTagAfterThink = nextOpen;
        break;
      }

      if (openTagAfterThink !== -1 && openTagAfterThink < content.length) {
        // Use balanced tag matching to find the correct closing tag
        const openTagEnd = openTagAfterThink + TOOL_FUNCTION_CALLS_OPEN.length;
        const closePos = findMatchingClosingTag(content, openTagEnd, TOOL_FUNCTION_CALLS_OPEN, closingTag);
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

  const kimiBlocks = extractKimiToolCalls(preprocessed);
  toolBlocks.push(...kimiBlocksToParsedToolBlocks(kimiBlocks));

  // Use balanced tag extraction instead of regex for proper nested content handling
  const functionCallsBlocks = extractFunctionCallsBlocks(preprocessed);

  for (const block of functionCallsBlocks) {
    const parsedBlocks = parseFunctionCallsBlock(block.innerContent, block.fullMatch);

    // Add all parsed invoke blocks
    toolBlocks.push(...parsedBlocks);
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

/**
 * Represents a pending (partial) invoke block where <${TOOL_XML_NAMESPACE}:invoke> opened but </${TOOL_XML_NAMESPACE}:invoke> hasn't arrived
 */
export interface PendingInvokeBlock {
  toolName: string;
  parameters: Record<string, unknown>;
}

function kimiPendingToPendingInvoke(pending: KimiPendingToolCall): PendingInvokeBlock {
  return {
    toolName: pending.toolName,
    parameters: pending.parameters,
  };
}

/**
 * Extract complete invoke blocks from content that may have an incomplete function_calls block.
 * This is used for incremental tool execution - we can start executing tools as soon as
 * their </${TOOL_XML_NAMESPACE}:invoke> closes, even before </${TOOL_XML_NAMESPACE}:function_calls> is received.
 * 
 * Also returns pending invoke blocks (where <${TOOL_XML_NAMESPACE}:invoke> opened but </${TOOL_XML_NAMESPACE}:invoke> hasn't arrived yet)
 * so the UI can show them as "pending" with streaming content.
 * 
 * Returns: { blocks: ParsedToolBlock[], pendingBlocks: PendingInvokeBlock[], hasFunctionCallsClose: boolean }
 */
export function extractCompleteInvokeBlocksIncremental(content: string): {
  blocks: ParsedToolBlock[];
  pendingBlocks: PendingInvokeBlock[];
  hasFunctionCallsClose: boolean;
} {
  // Note: Fence detection removed - it caused issues with writing content containing ```
  let preprocessed = preprocessContent(content);
  preprocessed = recoverMissingFunctionCallsWrapper(preprocessed);
  const blocks: ParsedToolBlock[] = [];
  const pendingBlocks: PendingInvokeBlock[] = [];

  const kimiIncremental = extractKimiToolCallsIncremental(preprocessed);
  if (kimiIncremental.blocks.length > 0 || kimiIncremental.pendingBlocks.length > 0) {
    blocks.push(...kimiBlocksToParsedToolBlocks(kimiIncremental.blocks));
    pendingBlocks.push(...kimiIncremental.pendingBlocks.map(kimiPendingToPendingInvoke));
    return {
      blocks,
      pendingBlocks,
      hasFunctionCallsClose: kimiIncremental.hasToolCallsClose,
    };
  }

  // Check if we have a function_calls opening
  const openTag = TOOL_FUNCTION_CALLS_OPEN;
  const closeTag = TOOL_FUNCTION_CALLS_CLOSE;
  const parserFlags = (globalThis as unknown as {
    __ECHODE_TOOL_PARSER_FLAGS__?: {
      skipBacktickTools?: boolean;
      skipExampleTools?: boolean;
    };
  }).__ECHODE_TOOL_PARSER_FLAGS__;

  const searchStart = 0;

  // Find a function_calls opening that is not inside a code block
  let openPos = searchStart;
  while (openPos < preprocessed.length) {
    openPos = preprocessed.indexOf(openTag, openPos);
    if (openPos === -1) {
      return { blocks: [], pendingBlocks: [], hasFunctionCallsClose: false };
    }

    // Skip if preceded by backtick (inside code block or inline code)
    if (parserFlags?.skipBacktickTools && openPos > 0 && preprocessed[openPos - 1] === '`') {
      openPos += openTag.length;
      continue;
    }

    // Skip if inside <${TOOL_XML_NAMESPACE}:parameter> values or inside a think/thinking block
    if (isInsideParameterValue(preprocessed, openPos) || isInsideThinkBlock(preprocessed, openPos)) {
      openPos += openTag.length;
      continue;
    }

    // Check if there's significant text before the function_calls tag (after thinking blocks).
    // If so, this is likely an AI explanation about tool usage, not a real tool call.
    // Real tool calls typically appear on their own line, possibly after descriptive text separated by blank lines.
    const textBeforeTag = preprocessed.slice(searchStart, openPos);

    // Check if the function_calls tag is on the same line as explanatory text
    // by looking at the content from the last newline to the tag
    const lastNewlinePos = textBeforeTag.lastIndexOf('\n');
    const textOnSameLine = lastNewlinePos >= 0
      ? textBeforeTag.slice(lastNewlinePos + 1).trim()
      : textBeforeTag.trim();

    // If there's significant text on the same line as <${TOOL_XML_NAMESPACE}:function_calls>, it's likely an explanation
    if (parserFlags?.skipExampleTools && textOnSameLine.length > 0) {
      // Check for common explanation patterns
      const isLikelyExplanation =
        /(?:example|here(?:'s| is)|for instance|like this|as follows|such as|usage:|format:|e\.g\.|i\.e\.)/i.test(textOnSameLine) ||
        textOnSameLine.endsWith(':'); // Text ending with colon before the tag suggests it's an example

      if (isLikelyExplanation) {
        openPos += openTag.length;
        continue;
      }
    }

    break;
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

  // Find pending (partial) invoke blocks - where <${TOOL_XML_NAMESPACE}:invoke> opened but </${TOOL_XML_NAMESPACE}:invoke> hasn't arrived
  // Search for invoke opening tags that don't have a matching close
  const invokeOpenRegex = new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>`, 'g');
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
    const parsed: ParsedToolBlock = {
      type: 'tool',
      toolName,
      parameters,
      rawContent,
    };

    // Note: Tool payloads may contain nested tag-like text; parsing uses balanced tag matching.
    return parsed;
  } catch {
    return null;
  }
}
