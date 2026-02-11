/**
 * Content cleaning utilities for fixing AI formatting mistakes
 * Single Responsibility: Clean and normalize tool call XML content
 */

 import { stripRequestBoundaryMarkers } from '../../utils/think-block-parser';
 import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';
 import { findMatchingClosingTag, isInsideParameterValue } from './tag-matcher';
 import {
  KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS,
  KIMI_TOOL_CALLS_SECTION_END_TAGS,
 } from '../kimi-parser';

 function findNextTagIndex(content: string, fromIndex: number, tags: readonly string[]): number {
  let best = -1;
  for (const tag of tags) {
    const idx = content.indexOf(tag, fromIndex);
    if (idx !== -1 && (best === -1 || idx < best)) {
      best = idx;
    }
  }
  return best;
 }

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

  // Fix bare closing tags missing the namespace prefix.
  // AI sometimes writes </invoke> instead of </tool:invoke>, etc.
  // Only target known tool tag names to avoid mangling unrelated content.
  if (cleaned.includes('</invoke>') || cleaned.includes('</parameter>') || cleaned.includes('</function_calls>')) {
    hadErrors = true;
    cleaned = cleaned.replace(/<\/invoke>/g, `</${TOOL_XML_NAMESPACE}:invoke>`);
    cleaned = cleaned.replace(/<\/parameter>/g, `</${TOOL_XML_NAMESPACE}:parameter>`);
    cleaned = cleaned.replace(/<\/function_calls>/g, `</${TOOL_XML_NAMESPACE}:function_calls>`);
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
  const THINK_OPEN = '<think>';
  const THINKING_OPEN = '<thinking>';
  const THINK_CLOSE = '</think>';
  const THINKING_CLOSE = '</thinking>';

  let result = '';
  let i = 0;

  while (i < content.length) {
    const nextThink = content.indexOf(THINK_OPEN, i);
    const nextThinking = content.indexOf(THINKING_OPEN, i);

    if (nextThink === -1 && nextThinking === -1) {
      result += content.slice(i);
      break;
    }

    const openPos =
      nextThink !== -1 && (nextThinking === -1 || nextThink < nextThinking)
        ? nextThink
        : nextThinking;
    const openTag = openPos === nextThink ? THINK_OPEN : THINKING_OPEN;
    const closeTag = openTag === THINK_OPEN ? THINK_CLOSE : THINKING_CLOSE;

    if (isInsideParameterValue(content, openPos) || (openPos > 0 && content[openPos - 1] === '`')) {
      result += content.slice(i, openPos + openTag.length);
      i = openPos + openTag.length;
      continue;
    }

    result += content.slice(i, openPos);
    const thinkContentStart = openPos + openTag.length;
    const closeIndex = content.indexOf(closeTag, thinkContentStart);
    const thinkContentEnd = closeIndex === -1 ? content.length : closeIndex;

    let thinkScanPos = thinkContentStart;
    while (thinkScanPos < thinkContentEnd) {
      const toolOpenPos = content.indexOf(TOOL_FUNCTION_CALLS_OPEN, thinkScanPos);
      const kimiSectionOpenPos = findNextTagIndex(content, thinkScanPos, KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS);

      const nextOpen =
        toolOpenPos !== -1 && (kimiSectionOpenPos === -1 || toolOpenPos < kimiSectionOpenPos)
          ? toolOpenPos
          : kimiSectionOpenPos;

      if (nextOpen === -1 || nextOpen >= thinkContentEnd) {
        break;
      }

      if (isInsideParameterValue(content, nextOpen) || (nextOpen > 0 && content[nextOpen - 1] === '`')) {
        thinkScanPos = nextOpen + 1;
        continue;
      }

      if (nextOpen === toolOpenPos) {
        const openTagEnd = toolOpenPos + TOOL_FUNCTION_CALLS_OPEN.length;
        const toolClosePos = findMatchingClosingTag(
          content,
          openTagEnd,
          TOOL_FUNCTION_CALLS_OPEN,
          TOOL_FUNCTION_CALLS_CLOSE
        );
        if (toolClosePos === -1) {
          break;
        }

        const toolBlockEnd = toolClosePos + TOOL_FUNCTION_CALLS_CLOSE.length;
        result += content.slice(toolOpenPos, toolBlockEnd);
        thinkScanPos = toolBlockEnd;
        continue;
      }

      // Kimi tool_calls section
      const sectionBeginTag = KIMI_TOOL_CALLS_SECTION_BEGIN_TAGS.find((t) => content.startsWith(t, kimiSectionOpenPos)) ?? '';
      const sectionContentStart = kimiSectionOpenPos + sectionBeginTag.length;
      const sectionClosePos = findNextTagIndex(content, sectionContentStart, KIMI_TOOL_CALLS_SECTION_END_TAGS);
      const sectionEnd = sectionClosePos === -1
        ? thinkContentEnd
        : Math.min(
          thinkContentEnd,
          sectionClosePos + (KIMI_TOOL_CALLS_SECTION_END_TAGS.find((t) => content.startsWith(t, sectionClosePos))?.length ?? 0)
        );
      result += content.slice(kimiSectionOpenPos, sectionEnd);
      thinkScanPos = sectionEnd;
    }

    if (closeIndex === -1) {
      break;
    }
    i = closeIndex + closeTag.length;
  }

  return stripRequestBoundaryMarkers(result);
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
