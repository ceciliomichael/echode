/**
 * Balanced tag matching utilities for XML parsing
 * Single Responsibility: Find matching closing tags with proper nesting support
 */

/**
 * Check if a position is inside a parameter value (between <parameter...> and </parameter>)
 * This helps avoid counting tags mentioned in text content as real tags
 * Uses depth counting to handle nested parameters correctly
 */
export function isInsideParameterValue(content: string, position: number): boolean {
  const beforePos = content.slice(0, position);

  let depth = 0;
  let searchPos = 0;
  const paramOpenRegex = /<parameter\s+name=["'][^"']+["']>/g;
  const paramClose = '</parameter>';

  while (searchPos < beforePos.length) {
    paramOpenRegex.lastIndex = searchPos;
    const openMatch = paramOpenRegex.exec(beforePos);
    const nextOpen = openMatch ? openMatch.index : -1;
    const nextCloseIdx = beforePos.indexOf(paramClose, searchPos);

    if (nextOpen === -1 && nextCloseIdx === -1) break;

    if (nextOpen !== -1 && (nextCloseIdx === -1 || nextOpen < nextCloseIdx)) {
      depth++;
      searchPos = nextOpen + openMatch![0].length;
    } else if (nextCloseIdx !== -1) {
      depth = Math.max(0, depth - 1);
      searchPos = nextCloseIdx + paramClose.length;
    } else {
      break;
    }
  }

  return depth > 0;
}

/**
 * Check if a position is inside a parameter value for invoke blocks
 * Uses depth counting to handle nested parameter tags
 */
export function isInsideInvokeParameterValue(content: string, position: number): boolean {
  const beforePos = content.slice(0, position);

  let depth = 0;
  let searchPos = 0;
  const paramOpenRegex = /<parameter\s+name=["'][^"']+["']>/g;
  const paramClose = '</parameter>';

  while (searchPos < beforePos.length) {
    paramOpenRegex.lastIndex = searchPos;
    const openMatch = paramOpenRegex.exec(beforePos);
    const nextOpen = openMatch ? openMatch.index : -1;
    const nextClose = beforePos.indexOf(paramClose, searchPos);

    if (nextOpen === -1 && nextClose === -1) break;

    if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
      depth++;
      searchPos = nextOpen + openMatch![0].length;
    } else if (nextClose !== -1) {
      depth = Math.max(0, depth - 1);
      searchPos = nextClose + paramClose.length;
    } else {
      break;
    }
  }

  return depth > 0;
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
 */
export function findMatchingParameterClose(content: string, openTagEnd: number): number {
  let depth = 1;
  let pos = openTagEnd;
  const openPattern = /<parameter\s+name=["'][^"']+["']>/;
  const closeTag = '</parameter>';

  while (pos < content.length && depth > 0) {
    const remaining = content.slice(pos);
    const openMatch = remaining.match(openPattern);
    const closePos = remaining.indexOf(closeTag);

    if (closePos === -1) {
      return -1;
    }

    const nextOpenPos = openMatch ? openMatch.index! : -1;

    if (nextOpenPos !== -1 && nextOpenPos < closePos) {
      depth++;
      pos += nextOpenPos + openMatch![0].length;
    } else {
      depth--;
      if (depth === 0) {
        return pos + closePos;
      }
      pos += closePos + closeTag.length;
    }
  }

  return -1;
}
