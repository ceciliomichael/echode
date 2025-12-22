/**
 * Check if a position is inside a <parameter> value for function_calls matching
 * Used to skip tags that appear as examples inside parameter content
 * 
 * IMPORTANT: Uses open/close counting to properly handle raw </parameter> text in content.
 */
export function isInsideFunctionCallsParameterValue(content: string, position: number): boolean {
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
 * Check if a position is inside a <parameter> value
 * Used to skip invoke tags that appear as examples inside parameter content
 * 
 * IMPORTANT: Uses the same counting strategy as findMatchingParameterClose to handle
 * raw </parameter> text in content that is NOT a real closing tag.
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
 * Uses balanced tag counting to handle nested content that may contain similar-looking tags
 * Respects parameter boundaries - ignores tags inside parameter values
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

        // No more closing tags found
        if (nextClose === -1) {
            return -1;
        }

        // Check which comes first
        if (nextOpen !== -1 && nextOpen < nextClose) {
            // Only count as nested if NOT inside a parameter value
            if (!isInsideFunctionCallsParameterValue(content, nextOpen)) {
                depth++;
            }
            pos = nextOpen + openTag.length;
        } else {
            // Only count as closing if NOT inside a parameter value
            if (!isInsideFunctionCallsParameterValue(content, nextClose)) {
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
 * Find the matching closing tag for a parameter using balanced tag counting.
 * This handles nested <parameter>...</parameter> tags inside content values.
 * Uses regex to properly match <parameter name="..."> opening tags.
 * Returns the position of the closing </parameter> tag, or -1 if not found.
 * 
 * IMPORTANT: This function handles the case where content contains raw </parameter>
 * text that is NOT a real closing tag (e.g., when AI writes tool XML inside a file).
 * We only match closing tags that have a corresponding opening tag at the same nesting level.
 * 
 * HEURISTIC: To disambiguate raw </parameter> text from the real closing tag,
 * we check if the candidate closing tag is followed by <parameter or </invoke>.
 */
export function findMatchingParameterClose(content: string, openTagEnd: number): number {
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
            // Found closing tag
            const closeTagEnd = nextClosePos + closeTag.length;
            const lookahead = content.slice(closeTagEnd);

            // Valid followers: <parameter, </parameter, </invoke, or End of String
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

/**
 * Find matching closing tag for invoke using balanced tag counting
 * Respects parameter boundaries - ignores invoke tags inside parameter values
 */
export function findMatchingInvokeClosingTagRespectingParams(content: string, openTagEnd: number): number {
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
            // Only count as nested if NOT inside a parameter value
            if (!isInsideInvokeParameterValue(content, nextOpen)) {
                depth++;
            }
            pos = nextOpen + openMatch![0].length;
        } else {
            // Only count as closing if NOT inside a parameter value
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
 * Find matching </function_calls> tag using balanced matching
 * Returns the position of the closing tag, or -1 if not found
 */
export function findMatchingFunctionCallsClose(content: string, openTagEnd: number): number {
    return findMatchingClosingTag(content, openTagEnd, '<function_calls>', '</function_calls>');
}

/**
 * Find the next tool block start position (function_calls tag)
 * Skips tags that are preceded by backticks (inside code blocks)
 */
export function findNextToolStart(content: string, fromPosition: number): number {
    const tag = '<function_calls>';
    let inFence = false;

    for (let i = 0; i < content.length;) {
        if (content.startsWith('```', i)) {
            inFence = !inFence;
            i += 3;

            if (inFence) {
                while (i < content.length && content[i] !== '\n' && content[i] !== '\r') {
                    i++;
                }
            }

            continue;
        }

        if (i >= fromPosition && !inFence && content.startsWith(tag, i)) {
            if (i > 0 && content[i - 1] === '`') {
                i += tag.length;
                continue;
            }

            return i;
        }

        i++;
    }

    return -1;
}

/**
 * Find the next mermaid block start position
 */
export function findNextMermaidStart(content: string, fromPosition: number): number {
    const pos = content.indexOf('```mermaid', fromPosition);
    return pos !== -1 ? pos : -1;
}

/**
 * Find the closing ``` for a mermaid block
 */
export function findMermaidClose(content: string, afterMermaidTag: number): number {
    const pos = content.indexOf('```', afterMermaidTag);
    return pos !== -1 ? pos : -1;
}
