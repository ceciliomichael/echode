/**
 * Balanced tag matching utilities for XML parsing
 * Single Responsibility: Find matching closing tags with proper nesting support
 */

import { TOOL_XML_NAMESPACE } from '../tool-xml';

/**
 * Check if a position is inside a parameter value (between <${TOOL_XML_NAMESPACE}:parameter...> and </${TOOL_XML_NAMESPACE}:parameter>)
 * This helps avoid counting tags mentioned in text content as real tags
 * 
 * IMPORTANT: Uses open/close counting to properly handle raw </${TOOL_XML_NAMESPACE}:parameter> text in content.
 */
export function isInsideParameterValue(content: string, position: number): boolean {
  return getParameterDepthAtPosition(content, position) > 0;
}

/**
 * Check if a position is inside a parameter value for invoke blocks
 * 
 * IMPORTANT: Uses open/close counting to properly handle raw </${TOOL_XML_NAMESPACE}:parameter> text in content.
 */
export function isInsideInvokeParameterValue(content: string, position: number): boolean {
  return getParameterDepthAtPosition(content, position) > 0;
}

function getParameterDepthAtPosition(content: string, position: number): number {
  const beforePos = content.slice(0, position);

  let depth = 0;
  let searchPos = 0;
  const paramOpenRegex = new RegExp(
    `<${TOOL_XML_NAMESPACE}:parameter(?:\\s+[^>]+)?\\s+name\\s*=\\s*["'][^"']+["'][^>]*>`,
    'g'
  );
  const paramClose = `</${TOOL_XML_NAMESPACE}:parameter>`;

  while (searchPos < beforePos.length) {
    paramOpenRegex.lastIndex = searchPos;
    const openMatch = paramOpenRegex.exec(beforePos);
    const nextOpen = openMatch ? openMatch.index : -1;
    const nextClosePos = beforePos.indexOf(paramClose, searchPos);

    if (nextOpen === -1 && nextClosePos === -1) {break;}

    if (nextOpen !== -1 && (nextClosePos === -1 || nextOpen < nextClosePos)) {
      depth++;
      searchPos = nextOpen + openMatch![0].length;
    } else if (nextClosePos !== -1) {
      if (depth > 0) {
        depth--;
      }
      searchPos = nextClosePos + paramClose.length;
    } else {
      break;
    }
  }

  return depth;
}

/**
 * Find the matching closing tag for a given opening tag position
 * Uses balanced tag counting to handle nested content
 */
export function findMatchingClosingTag(
  content: string,
  openTagEnd: number,
  openTag: string,
  closeTag: string
): number {
  let depth = 1;
  let pos = openTagEnd;

  while (pos < content.length && depth > 0) {
    const nextOpen = content.indexOf(openTag, pos);
    const nextClose = content.indexOf(closeTag, pos);

    if (nextClose === -1) {
      return -1;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      if (!isInsideParameterValue(content, nextOpen)) {
        depth++;
      }
      pos = nextOpen + openTag.length;
    } else {
      if (isInsideParameterValue(content, nextClose)) {
        pos = nextClose + closeTag.length;
        continue;
      }
      depth--;
      if (depth === 0) {
        return nextClose;
      }
      pos = nextClose + closeTag.length;
    }
  }

  return -1;
}

/**
 * Find matching closing tag for invoke, respecting parameter boundaries
 * Tags inside parameter values are not counted for depth tracking
 */
export function findMatchingInvokeClosingTag(content: string, openTagEnd: number): number {
  let depth = 1;
  let pos = openTagEnd;
  const openingTagRegex = new RegExp(
    `<${TOOL_XML_NAMESPACE}:invoke\\b[^>]*\\bname\\s*=\\s*["'][^"']+["'][^>]*>`
    , 'g'
  );
  const closeTag = `</${TOOL_XML_NAMESPACE}:invoke>`;

  while (pos < content.length && depth > 0) {
    openingTagRegex.lastIndex = pos;
    const openMatch = openingTagRegex.exec(content);
    const nextOpen = openMatch ? openMatch.index : -1;
    const nextClose = content.indexOf(closeTag, pos);

    if (nextClose === -1) {
      return -1;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      if (!isInsideInvokeParameterValue(content, nextOpen)) {
        depth++;
      }
      pos = nextOpen + openMatch![0].length;
    } else {
      if (isInsideInvokeParameterValue(content, nextClose)) {
        pos = nextClose + closeTag.length;
        continue;
      }
      depth--;
      if (depth === 0) {
        return nextClose;
      }
      pos = nextClose + closeTag.length;
    }
  }

  return -1;
}

/**
 * Find the matching closing tag for a parameter using balanced tag counting
 * Handles nested <${TOOL_XML_NAMESPACE}:parameter>...</${TOOL_XML_NAMESPACE}:parameter> tags inside content values
 * 
 * IMPORTANT: This function handles the case where content contains raw </${TOOL_XML_NAMESPACE}:parameter>
 * text that is NOT a real closing tag (e.g., when AI writes tool XML inside a file).
 * We only match closing tags that have a corresponding opening tag at the same nesting level.
 */
export function findMatchingParameterClose(content: string, openTagEnd: number): number {
  let nestedParameterDepth = 0;
  let nestedInvokeDepth = 0;
  let nestedFunctionCallsDepth = 0;
  let pos = openTagEnd;

  const parameterOpenPattern = new RegExp(
    `<${TOOL_XML_NAMESPACE}:parameter(?:\\s+[^>]+)?\\s+name\\s*=\\s*["'][^"']+["'][^>]*>`
    , 'g'
  );
  const invokeOpenPattern = new RegExp(
    `<${TOOL_XML_NAMESPACE}:invoke\\b[^>]*\\bname\\s*=\\s*["'][^"']+["'][^>]*>`
    , 'g'
  );
  const functionCallsOpenTag = `<${TOOL_XML_NAMESPACE}:function_calls>`;
  const closeTag = `</${TOOL_XML_NAMESPACE}:parameter>`;
  const closeTagLength = closeTag.length;
  const invokeCloseTag = `</${TOOL_XML_NAMESPACE}:invoke>`;
  const invokeCloseTagLength = invokeCloseTag.length;
  const functionCallsCloseTag = `</${TOOL_XML_NAMESPACE}:function_calls>`;
  const functionCallsCloseTagLength = functionCallsCloseTag.length;

  const isLikelyBoundaryTag = (pos: number): boolean => {
    if (pos >= content.length) {
      return true;
    }

    return content.startsWith(`<${TOOL_XML_NAMESPACE}:parameter`, pos)
      || content.startsWith(`</${TOOL_XML_NAMESPACE}:invoke>`, pos)
      || content.startsWith(`</${TOOL_XML_NAMESPACE}:function_calls>`, pos);
  };

  const skipWhitespace = (start: number): number => {
    let idx = start;
    while (idx < content.length && /[\t\r\n ]/.test(content[idx])) {
      idx++;
    }
    return idx;
  };

  const isLikelyRealParameterClose = (closePos: number): boolean => {
    let idx = skipWhitespace(closePos + closeTagLength);

    if (isLikelyBoundaryTag(idx)) {
      return true;
    }

    // Malformed model output sometimes emits duplicate closing parameter tags:
    // </parameter></parameter></invoke>
    // Treat the first close as the real one if duplicate closes are immediately followed by a boundary tag.
    while (content.startsWith(closeTag, idx)) {
      idx = skipWhitespace(idx + closeTagLength);
      if (isLikelyBoundaryTag(idx)) {
        return true;
      }
    }

    return false;
  };

  while (pos < content.length) {
    parameterOpenPattern.lastIndex = pos;
    const nextParameterOpenMatch = parameterOpenPattern.exec(content);
    const nextParameterOpenPos = nextParameterOpenMatch ? nextParameterOpenMatch.index : -1;
    const nextParameterOpenEnd = nextParameterOpenMatch
      ? nextParameterOpenMatch.index + nextParameterOpenMatch[0].length
      : -1;

    invokeOpenPattern.lastIndex = pos;
    const nextInvokeOpenMatch = invokeOpenPattern.exec(content);
    const nextInvokeOpenPos = nextInvokeOpenMatch ? nextInvokeOpenMatch.index : -1;
    const nextInvokeOpenEnd = nextInvokeOpenMatch
      ? nextInvokeOpenMatch.index + nextInvokeOpenMatch[0].length
      : -1;

    const nextFunctionCallsOpenPos = content.indexOf(functionCallsOpenTag, pos);
    const nextFunctionCallsOpenEnd = nextFunctionCallsOpenPos === -1
      ? -1
      : nextFunctionCallsOpenPos + functionCallsOpenTag.length;

    const nextClosePos = content.indexOf(closeTag, pos);
    const nextInvokeClosePos = content.indexOf(invokeCloseTag, pos);
    const nextFunctionCallsClosePos = content.indexOf(functionCallsCloseTag, pos);

    const candidates = [
      { type: 'parameter_open' as const, pos: nextParameterOpenPos, end: nextParameterOpenEnd },
      { type: 'invoke_open' as const, pos: nextInvokeOpenPos, end: nextInvokeOpenEnd },
      { type: 'function_calls_open' as const, pos: nextFunctionCallsOpenPos, end: nextFunctionCallsOpenEnd },
      { type: 'parameter_close' as const, pos: nextClosePos, end: nextClosePos === -1 ? -1 : nextClosePos + closeTagLength },
      { type: 'invoke_close' as const, pos: nextInvokeClosePos, end: nextInvokeClosePos === -1 ? -1 : nextInvokeClosePos + invokeCloseTagLength },
      { type: 'function_calls_close' as const, pos: nextFunctionCallsClosePos, end: nextFunctionCallsClosePos === -1 ? -1 : nextFunctionCallsClosePos + functionCallsCloseTagLength },
    ].filter(c => c.pos !== -1);

    if (candidates.length === 0) {
      return -1;
    }

    const nextToken = candidates.reduce((earliest, current) =>
      current.pos < earliest.pos ? current : earliest
    );

    if (nextToken.type === 'parameter_open') {
      nestedParameterDepth++;
      pos = nextToken.end;
      continue;
    }

    if (nextToken.type === 'invoke_open') {
      nestedInvokeDepth++;
      pos = nextToken.end;
      continue;
    }

    if (nextToken.type === 'function_calls_open') {
      nestedFunctionCallsDepth++;
      pos = nextToken.end;
      continue;
    }

    if (nextToken.type === 'invoke_close') {
      if (nestedInvokeDepth > 0) {
        nestedInvokeDepth--;
      }
      pos = nextToken.end;
      continue;
    }

    if (nextToken.type === 'function_calls_close') {
      if (nestedFunctionCallsDepth > 0) {
        nestedFunctionCallsDepth--;
      }
      pos = nextToken.end;
      continue;
    }

    // parameter_close
    if (nestedParameterDepth > 0) {
      nestedParameterDepth--;
      pos = nextToken.end;
      continue;
    }

    // If we're still inside nested invoke/function_calls tags, this close belongs to nested content.
    if (nestedInvokeDepth > 0 || nestedFunctionCallsDepth > 0) {
      pos = nextToken.end;
      continue;
    }

    if (!isLikelyRealParameterClose(nextToken.pos)) {
      pos = nextToken.end;
      continue;
    }

    return nextToken.pos;
  }

  return -1;
}
