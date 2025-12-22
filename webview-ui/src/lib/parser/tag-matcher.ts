/**
 * Balanced tag matching utilities for XML parsing
 * Single Responsibility: Find matching closing tags with proper nesting support
 */

/**
 * Check if a position is inside a parameter value (between <parameter...> and </parameter>)
 * This helps avoid counting tags mentioned in text content as real tags
 * 
 * IMPORTANT: Uses open/close counting to properly handle raw </parameter> text in content.
 */
export function isInsideParameterValue(content: string, position: number): boolean {
  const beforePos = content.slice(0, position);

  // Track open and close counts separately
  // A position is "inside" a parameter if openCount > closeCount
  let openCount = 0;
  let closeCount = 0;
  let searchPos = 0;
  const paramOpenRegex = /<parameter(?:\s+[^>]+)?\s+name\s*=\s*["'][^"']+["'][^>]*>/g;
  const paramClose = '</parameter>';

  while (searchPos < beforePos.length) {
    paramOpenRegex.lastIndex = searchPos;
    const openMatch = paramOpenRegex.exec(beforePos);
    const nextOpen = openMatch ? openMatch.index : -1;
    const nextClosePos = beforePos.indexOf(paramClose, searchPos);

    if (nextOpen === -1 && nextClosePos === -1) {break;}

    if (nextOpen !== -1 && (nextClosePos === -1 || nextOpen < nextClosePos)) {
      // Found opening tag
      openCount++;
      searchPos = nextOpen + openMatch![0].length;
    } else if (nextClosePos !== -1) {
      // Found closing tag - VALIDATE ALWAYS
      const closeTagEnd = nextClosePos + paramClose.length;
      const lookahead = content.slice(closeTagEnd);
      // Valid followers: <parameter, </parameter, </invoke, or End of String
      const isValidClose = /^\s*($|<parameter|<\/parameter|<\/invoke)/.test(lookahead);

      if (isValidClose) {
        closeCount++;
      }
      // Either way, move past this closing tag
      searchPos = nextClosePos + paramClose.length;
    } else {
      break;
    }
  }

  // We're inside a parameter if there are more opens than closes
  return openCount > closeCount;
}

/**
 * Check if a position is inside a parameter value for invoke blocks
 * 
 * IMPORTANT: Uses open/close counting to properly handle raw </parameter> text in content.
 */
export function isInsideInvokeParameterValue(content: string, position: number): boolean {
  const beforePos = content.slice(0, position);

  // Track open and close counts separately
  // A position is "inside" a parameter if openCount > closeCount
  let openCount = 0;
  let closeCount = 0;
  let searchPos = 0;
  const paramOpenRegex = /<parameter(?:\s+[^>]+)?\s+name\s*=\s*["'][^"']+["'][^>]*>/g;
  const paramClose = '</parameter>';

  while (searchPos < beforePos.length) {
    paramOpenRegex.lastIndex = searchPos;
    const openMatch = paramOpenRegex.exec(beforePos);
    const nextOpen = openMatch ? openMatch.index : -1;
    const nextClosePos = beforePos.indexOf(paramClose, searchPos);

    if (nextOpen === -1 && nextClosePos === -1) {break;}

    if (nextOpen !== -1 && (nextClosePos === -1 || nextOpen < nextClosePos)) {
      // Found opening tag
      openCount++;
      searchPos = nextOpen + openMatch![0].length;
    } else if (nextClosePos !== -1) {
      // Found closing tag - VALIDATE ALWAYS
      const closeTagEnd = nextClosePos + paramClose.length;
      const lookahead = content.slice(closeTagEnd);
      // Valid followers: <parameter, </parameter, </invoke, or End of String
      const isValidClose = /^\s*($|<parameter|<\/parameter|<\/invoke)/.test(lookahead);

      if (isValidClose) {
        closeCount++;
      }
      // Either way, move past this closing tag
      searchPos = nextClosePos + paramClose.length;
    } else {
      break;
    }
  }

  // We're inside a parameter if there are more opens than closes
  return openCount > closeCount;
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
      if (!isInsideParameterValue(content, nextClose)) {
        depth--;
        if (depth === 0) {
          return nextClose;
        }
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
  const openingTagRegex = /<invoke\s+name=["'][^"']+["']>/g;
  const closeTag = '</invoke>';

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
      if (!isInsideInvokeParameterValue(content, nextClose)) {
        depth--;
        if (depth === 0) {
          return nextClose;
        }
      }
      pos = nextClose + closeTag.length;
    }
  }

  return -1;
}

/**
 * Find the matching closing tag for a parameter using balanced tag counting
 * Handles nested <parameter>...</parameter> tags inside content values
 * 
 * IMPORTANT: This function handles the case where content contains raw </parameter>
 * text that is NOT a real closing tag (e.g., when AI writes tool XML inside a file).
 * We only match closing tags that have a corresponding opening tag at the same nesting level.
 */
export function findMatchingParameterClose(content: string, openTagEnd: number): number {
  // Strategy: We need to distinguish between:
  // 1. Real nested <parameter name="...">...</parameter> pairs (should be balanced)
  // 2. Raw </parameter> text in content without a matching opening tag (should be IGNORED)
  //
  // To do this, we scan forward and track:
  // - openCount: number of <parameter name="..."> tags seen
  // - closeCount: number of </parameter> tags seen
  // The FIRST </parameter> that makes closeCount > openCount is our real closing tag
  // (since we started with depth=1 for the outer parameter)

  let openCount = 0;  // Nested opening tags seen
  let closeCount = 0; // Closing tags seen
  let pos = openTagEnd;
  const openPattern = /<parameter(?:\s+[^>]+)?\s+name\s*=\s*["'][^"']+["'][^>]*>/g;
  const closeTag = '</parameter>';

  while (pos < content.length) {
    // Find next opening and closing tags from current position
    openPattern.lastIndex = pos;
    const openMatch = openPattern.exec(content);
    const nextOpenPos = openMatch ? openMatch.index : -1;
    const nextClosePos = content.indexOf(closeTag, pos);

    // No more closing tags found
    if (nextClosePos === -1) {
      return -1;
    }

    // Check which comes first
    if (nextOpenPos !== -1 && nextOpenPos < nextClosePos) {
      // Found nested opening tag first - track it
      openCount++;
      pos = nextOpenPos + openMatch![0].length;
    } else {
      // Found closing tag - VALIDATE ALWAYS with lookahead
      const closeTagEnd = nextClosePos + closeTag.length;
      const lookahead = content.slice(closeTagEnd);

      // VALIDATE ALWAYS: <parameter (sibling), </parameter (parent), </invoke, or End of String
      const isValidClose = /^\s*($|<parameter|<\/parameter|<\/invoke)/.test(lookahead);

      if (isValidClose) {
        if (closeCount < openCount) {
          // Matches a nested opening tag we've seen
          closeCount++;
          pos = closeTagEnd;
        } else {
          // closeCount >= openCount means all nested pairs are closed
          // This is the real closing tag for our outer parameter
          return nextClosePos;
        }
      } else {
        // Fake closing tag (text content) - ignore it
        pos = closeTagEnd;
      }
    }
  }

  return -1;
}
