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
  const beforePos = content.slice(0, position);

  let isInside = false;
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
      if (!isInside) {
        isInside = true;
      }
      searchPos = nextOpen + openMatch![0].length;
    } else if (nextClosePos !== -1) {
      if (isInside) {
        isInside = false;
      }
      searchPos = nextClosePos + paramClose.length;
    } else {
      break;
    }
  }

  return isInside;
}

/**
 * Check if a position is inside a parameter value for invoke blocks
 * 
 * IMPORTANT: Uses open/close counting to properly handle raw </${TOOL_XML_NAMESPACE}:parameter> text in content.
 */
export function isInsideInvokeParameterValue(content: string, position: number): boolean {
  const beforePos = content.slice(0, position);

  let isInside = false;
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
      if (!isInside) {
        isInside = true;
      }
      searchPos = nextOpen + openMatch![0].length;
    } else if (nextClosePos !== -1) {
      if (isInside) {
        isInside = false;
      }
      searchPos = nextClosePos + paramClose.length;
    } else {
      break;
    }
  }

  return isInside;
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
  let openCount = 0;
  let closeCount = 0;
  let pos = openTagEnd;
  const openPattern = new RegExp(
    `<${TOOL_XML_NAMESPACE}:parameter(?:\\s+[^>]+)?\\s+name\\s*=\\s*["'][^"']+["'][^>]*>`
    , 'g'
  );
  const closeTag = `</${TOOL_XML_NAMESPACE}:parameter>`;
  const closeTagLength = closeTag.length;

  const isLikelyRealParameterClose = (closePos: number): boolean => {
    const afterClose = content.slice(closePos + closeTagLength);
    const trimmed = afterClose.replace(/^[\t\r\n ]+/, '');

    if (trimmed.length === 0) {
      return true;
    }

    return trimmed.startsWith(`<${TOOL_XML_NAMESPACE}:parameter`)
      || trimmed.startsWith(`</${TOOL_XML_NAMESPACE}:invoke>`)
      || trimmed.startsWith(`</${TOOL_XML_NAMESPACE}:function_calls>`);
  };

  while (pos < content.length) {
    openPattern.lastIndex = pos;
    const openMatch = openPattern.exec(content);
    const nextOpenPos = openMatch ? openMatch.index : -1;
    const nextClosePos = content.indexOf(closeTag, pos);

    if (nextClosePos === -1) {
      return -1;
    }

    if (nextOpenPos !== -1 && nextOpenPos < nextClosePos) {
      openCount++;
      pos = nextOpenPos + openMatch![0].length;
      continue;
    }

    const closeTagEnd = nextClosePos + closeTagLength;
    if (closeCount < openCount) {
      closeCount++;
      pos = closeTagEnd;
      continue;
    }

    if (!isLikelyRealParameterClose(nextClosePos)) {
      pos = closeTagEnd;
      continue;
    }

    return nextClosePos;
  }

  return -1;
}
