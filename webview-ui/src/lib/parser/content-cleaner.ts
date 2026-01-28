/**
 * Content cleaning utilities for fixing AI formatting mistakes
 * Single Responsibility: Clean and normalize tool call XML content
 */

 import { stripLeadingThinkBlocksByRequestBoundary, stripRequestBoundaryMarkers } from '../../utils/think-block-parser';
 import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';

/**
 * Clean up common AI mistakes in tool call formatting
 * Handles cases like duplicate opening tags, unclosed tags, malformed closing tags
 */
export function cleanToolCallContent(content: string): string {
  let cleaned = content;
  let hadErrors = false;

  // Remove duplicate opening tool blocks
  const duplicateOpenings = cleaned.match(new RegExp(`${TOOL_FUNCTION_CALLS_OPEN}\\s*${TOOL_FUNCTION_CALLS_OPEN}`, 'g'));
  if (duplicateOpenings) {
    hadErrors = true;
    cleaned = cleaned.replace(
      new RegExp(`${TOOL_FUNCTION_CALLS_OPEN}\\s*${TOOL_FUNCTION_CALLS_OPEN}`, 'g'),
      TOOL_FUNCTION_CALLS_OPEN
    );
  }

  // Remove duplicate closing tool blocks
  const duplicateClosings = cleaned.match(new RegExp(`${TOOL_FUNCTION_CALLS_CLOSE}\\s*${TOOL_FUNCTION_CALLS_CLOSE}`, 'g'));
  if (duplicateClosings) {
    hadErrors = true;
    cleaned = cleaned.replace(
      new RegExp(`${TOOL_FUNCTION_CALLS_CLOSE}\\s*${TOOL_FUNCTION_CALLS_CLOSE}`, 'g'),
      TOOL_FUNCTION_CALLS_CLOSE
    );
  }

  // Fix cases where AI forgot to close previous tag and opened a new one
  let unclosedFixed = 0;
  cleaned = cleaned.replace(
    new RegExp(
      `(${TOOL_FUNCTION_CALLS_OPEN}[\\s\\S]*?<${TOOL_XML_NAMESPACE}:invoke[\\s\\S]*?<\\/${TOOL_XML_NAMESPACE}:invoke>[\\s\\S]*?)(${TOOL_FUNCTION_CALLS_OPEN})`,
      'g'
    ),
    (match, firstBlock, secondTag) => {
      if (firstBlock.includes(TOOL_FUNCTION_CALLS_CLOSE)) {
        return match;
      }
      unclosedFixed++;
      return firstBlock + TOOL_FUNCTION_CALLS_CLOSE + '\n' + secondTag;
    }
  );

  if (unclosedFixed > 0) {
    hadErrors = true;
  }

  // Fix malformed closing tags with backslashes: <\param> -> </param>
  const backslashClosings = cleaned.match(/<\\[\w_-]+>/g);
  if (backslashClosings) {
    hadErrors = true;
    cleaned = cleaned.replace(/<\\([\w_-]+)>/g, '</$1>');
  }

  // Fix malformed invoke tags
  const malformedInvokes = cleaned.match(new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["'][^"']+["']\\s*[^>]*(?!>)`, 'g'));
  if (malformedInvokes) {
    hadErrors = true;
    // Handle malformed invoke tags
    cleaned = cleaned.replace(new RegExp(`<${TOOL_XML_NAMESPACE}:invoke\\s+name=["'][^"']+["']\\s*[^>]*(?!>)`, 'g'), '');
  }

  if (hadErrors) {
    // Handle errors if needed in the future
  }

  return cleaned;
}

/**
 * Remove a LEADING think/thinking block from content.
 *
 * IMPORTANT: We only remove a leading block (if the content literally starts with <think>/<thinking>).
 * Any other occurrences must remain untouched (e.g., inside edit/write_to_file payloads).
 */
export function removeThinkBlocks(content: string): string {
  const stripped = stripLeadingThinkBlocksByRequestBoundary(content).strippedContent;
  return stripRequestBoundaryMarkers(stripped);
}

/**
 * Remove markdown code blocks from content OUTSIDE of function_calls blocks.
 * Content INSIDE function_calls (including ```) is preserved as-is.
 */
export function removeCodeBlocks(content: string): string {
  let result = '';
  let i = 0;
  let inFence = false;
  let inFunctionCalls = false;

  const openTag = TOOL_FUNCTION_CALLS_OPEN;
  const closeTag = TOOL_FUNCTION_CALLS_CLOSE;

  while (i < content.length) {
    // Check for function_calls tags
    if (content.startsWith(openTag, i)) {
      inFunctionCalls = true;
      result += openTag;
      i += openTag.length;
      continue;
    }

    if (content.startsWith(closeTag, i)) {
      inFunctionCalls = false;
      result += closeTag;
      i += closeTag.length;
      continue;
    }

    // Inside function_calls: preserve EVERYTHING including ```
    if (inFunctionCalls) {
      result += content[i];
      i++;
      continue;
    }

    // Outside function_calls: handle code block fencing
    if (content.startsWith('```', i)) {
      inFence = !inFence;
      i += 3;
      // Skip language identifier on opening fence
      if (inFence) {
        while (i < content.length && content[i] !== '\n' && content[i] !== '\r') {
          i++;
        }
      }
      continue;
    }

    // Outside function_calls and outside fence: add to result
    if (!inFence) {
      result += content[i];
    }

    i++;
  }

  return result;
}

/**
 * Preprocess content for tool parsing
 * Combines code block removal, think block removal, and content cleaning
 */
export function preprocessContent(content: string): string {
  const withoutThink = removeThinkBlocks(content);
  return cleanToolCallContent(withoutThink);
}
