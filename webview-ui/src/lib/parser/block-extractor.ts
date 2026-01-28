/**
 * Block extraction utilities for parsing function_calls and invoke blocks
 * Single Responsibility: Extract XML blocks from content using balanced tag matching
 */

import {
  findMatchingClosingTag,
  findMatchingInvokeClosingTag,
  isInsideInvokeParameterValue,
} from './tag-matcher';

import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';

export interface FunctionCallsBlock {
  innerContent: string;
  fullMatch: string;
  startIndex: number;
  endIndex: number;
}

export interface InvokeBlock {
  toolName: string;
  innerContent: string;
  fullMatch: string;
}

/**
 * Extract function_calls blocks using balanced tag matching
 * Properly handles nested content that may contain </${TOOL_XML_NAMESPACE}:function_calls> text
 * Skips blocks that are inside code blocks (preceded by backticks)
 */
export function extractFunctionCallsBlocks(content: string): FunctionCallsBlock[] {
  const blocks: FunctionCallsBlock[] = [];
  const openTag = TOOL_FUNCTION_CALLS_OPEN;
  const closeTag = TOOL_FUNCTION_CALLS_CLOSE;
  const parserFlags = (globalThis as unknown as {
    __ECHODE_TOOL_PARSER_FLAGS__?: { skipFunctionCallsInBackticks?: boolean };
  }).__ECHODE_TOOL_PARSER_FLAGS__;
  let searchPos = 0;

  while (searchPos < content.length) {
    const openPos = content.indexOf(openTag, searchPos);
    if (openPos === -1) {break;}

    // Skip if preceded by backtick (inside code block or inline code)
    if (parserFlags?.skipFunctionCallsInBackticks && openPos > 0 && content[openPos - 1] === '`') {
      searchPos = openPos + openTag.length;
      continue;
    }

    const openTagEnd = openPos + openTag.length;
    const closePos = findMatchingClosingTag(content, openTagEnd, openTag, closeTag);

    if (closePos === -1) {
      break;
    }

    const innerContent = content.slice(openTagEnd, closePos);
    const fullMatch = content.slice(openPos, closePos + closeTag.length);

    blocks.push({
      innerContent,
      fullMatch,
      startIndex: openPos,
      endIndex: closePos + closeTag.length,
    });

    searchPos = closePos + closeTag.length;
  }

  return blocks;
}

/**
 * Extract invoke blocks using balanced tag matching
 * Handles nested content that may contain </${TOOL_XML_NAMESPACE}:invoke> text (e.g., in HTML/code)
 * IMPORTANT: Only extracts TOP-LEVEL invoke blocks, skipping nested invokes inside parameter values
 */
export function extractInvokeBlocks(content: string): InvokeBlock[] {
  const blocks: InvokeBlock[] = [];
  const invokeOpenRegex = new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["']([^"']+)["']>`, 'g');
  const closeTag = `</${TOOL_XML_NAMESPACE}:invoke>`;

  let match: RegExpExecArray | null;
  while ((match = invokeOpenRegex.exec(content)) !== null) {
    // Skip invoke tags that are inside parameter values
    if (isInsideInvokeParameterValue(content, match.index)) {
      continue;
    }

    const toolName = match[1];
    const openTagEnd = match.index + match[0].length;

    const closePos = findMatchingInvokeClosingTag(content, openTagEnd);

    if (closePos !== -1) {
      const innerContent = content.slice(openTagEnd, closePos);
      const fullMatch = content.slice(match.index, closePos + closeTag.length);

      blocks.push({
        toolName,
        innerContent,
        fullMatch,
      });

      // Skip past this entire invoke block to avoid finding nested invokes
      invokeOpenRegex.lastIndex = closePos + closeTag.length;
    }
  }

  return blocks;
}
