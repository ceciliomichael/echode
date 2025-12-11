/**
 * Content tokenization for stable rendering during streaming
 */

export type ContentToken =
  | { type: 'think'; content: string; index: number; isClosed: boolean }
  | { type: 'tool'; toolName: string; parameters: Record<string, unknown>; rawContent: string; index: number; isClosed: boolean; toolExecutionId: string }
  | { type: 'mermaid'; content: string; index: number; isClosed: boolean }
  | { type: 'text'; content: string; index: number };

/**
 * Check if a position is inside a <parameter> value for function_calls matching
 * Used to skip tags that appear as examples inside parameter content
 */
function isInsideFunctionCallsParameterValue(content: string, position: number): boolean {
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
 * Uses balanced tag counting to handle nested content that may contain similar-looking tags
 * Respects parameter boundaries - ignores tags inside parameter values
 */
function findMatchingClosingTag(
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
 */
function findMatchingParameterClose(content: string, openTagEnd: number): number {
  let depth = 1;
  let pos = openTagEnd;
  const openPattern = /<parameter\s+name=["'][^"']+["']>/;
  const closeTag = '</parameter>';

  while (pos < content.length && depth > 0) {
    // Find next opening and closing tags from current position
    const remaining = content.slice(pos);
    const openMatch = remaining.match(openPattern);
    const closePos = remaining.indexOf(closeTag);

    // No more closing tags found
    if (closePos === -1) {
      return -1;
    }

    const nextOpenPos = openMatch ? openMatch.index! : -1;

    // Check which comes first
    if (nextOpenPos !== -1 && nextOpenPos < closePos) {
      // Found another opening tag first - increase depth
      depth++;
      pos += nextOpenPos + openMatch![0].length;
    } else {
      // Found closing tag first - decrease depth
      depth--;
      if (depth === 0) {
        return pos + closePos;
      }
      pos += closePos + closeTag.length;
    }
  }

  return -1;
}

/**
 * Parse XML-style parameters from invoke block content
 * New format: <parameter name="paramName">value</parameter>
 * Handles both complete and partial/unclosed tags during streaming
 * Uses balanced tag matching to handle nested content (e.g., HTML with </script>)
 */
function parseXMLParameters(content: string): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  const processedParams = new Set<string>();

  // Find all parameter opening tags
  const openingParamRegex = /<parameter\s+name=["']([^"']+)["']>/g;
  let match: RegExpExecArray | null;

  while ((match = openingParamRegex.exec(content)) !== null) {
    const paramName = match[1];
    const openTagEnd = match.index + match[0].length;

    // Skip if already processed (handles duplicate tags)
    if (processedParams.has(paramName)) {
      continue;
    }

    // Find matching closing tag using balanced matching
    // This correctly handles nested </parameter> tags inside the content
    const closePos = findMatchingParameterClose(content, openTagEnd);

    if (closePos !== -1) {
      // Complete parameter tag found
      const paramValue = content.slice(openTagEnd, closePos);

      // Parameters that should ALWAYS be treated as raw strings (never parsed as JSON/numbers)
      const isRawStringParam = ['old_string', 'new_string', 'content', 'diff', 'edits', 'CodeContent'].includes(paramName);
      // Strip only leading/trailing newlines (AI adds newline after opening tag), preserve internal whitespace
      const finalValue = isRawStringParam
        ? paramValue.replace(/^\n/, '').replace(/\n$/, '')
        : paramValue.trim();
      // Skip parseParamValue for raw string params - they should never be converted to objects
      parameters[paramName] = isRawStringParam ? finalValue : parseParamValue(finalValue);
      processedParams.add(paramName);
    } else {
      // No closing tag found - this is streaming content (partial parameter)
      const partialContent = content.slice(openTagEnd);
      parameters[paramName] = partialContent;
      processedParams.add(paramName);
    }
  }

  return parameters;
}

/**
 * Parse parameter value with type coercion
 */
function parseParamValue(value: string): unknown {
  // Try to parse as JSON first (for arrays, objects)
  if (value.startsWith('[') || value.startsWith('{')) {
    try {
      return JSON.parse(value);
    } catch {
      // If it's a partial array, try to extract complete objects
      if (value.startsWith('[')) {
        const completeObjects = extractCompleteJsonObjects(value);
        if (completeObjects.length > 0) {
          return completeObjects;
        }
      }
      // If JSON parse fails, treat as string
    }
  }

  // Handle boolean values
  if (value === 'true') { return true; }
  if (value === 'false') { return false; }

  // Handle numeric values
  if (value && !isNaN(Number(value))) {
    return Number(value);
  }

  // Default: treat as string
  return value;
}

/**
 * Extract complete JSON objects from a partial array string
 * Used for streaming arrays like edits: [{...}, {...}]
 */
function extractCompleteJsonObjects(partialArray: string): unknown[] {
  const objects: unknown[] = [];

  // Remove leading [ and whitespace
  const content = partialArray.slice(1).trim();

  let depth = 0;
  let objStart = -1;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '{') {
      if (depth === 0) { objStart = i; }
      depth++;
    } else if (char === '}') {
      depth--;

      // Found a complete object
      if (depth === 0 && objStart !== -1) {
        const objStr = content.slice(objStart, i + 1);
        try {
          const obj = JSON.parse(objStr);
          objects.push(obj);
        } catch {
          // Skip malformed object
        }
        objStart = -1;
      }
    }
  }

  return objects;
}

/**
 * Check if a position is inside a <parameter> value
 * Used to skip invoke tags that appear as examples inside parameter content
 */
function isInsideInvokeParameterValue(content: string, position: number): boolean {
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
 * Extract ALL invoke blocks from content using balanced tag matching
 * Returns array of all invoke blocks found
 * IMPORTANT: Only extracts TOP-LEVEL invoke blocks, skipping nested invokes inside parameter values
 *
 * Each block is annotated with isClosed, which is true only when a matching </invoke>
 * has been found for that specific block. This is critical for streaming: in a
 * multi-invoke function_calls block, earlier invokes may be closed while the last
 * one is still streaming, and we must not mark that last invoke as closed until
 * its own </invoke> arrives.
 */
function extractAllInvokeBlocks(content: string): Array<{ toolName: string; innerContent: string; fullMatch: string; isClosed: boolean }> {
  const blocks: Array<{ toolName: string; innerContent: string; fullMatch: string; isClosed: boolean }> = [];
  const invokeOpenRegex = /<invoke\s+name=["']([^"']+)["']>/g;
  const closeTag = '</invoke>';

  let match: RegExpExecArray | null;
  while ((match = invokeOpenRegex.exec(content)) !== null) {
    // Skip invoke tags that are inside parameter values (examples in content)
    if (isInsideInvokeParameterValue(content, match.index)) {
      continue;
    }
    
    const toolName = match[1];
    const openTagEnd = match.index + match[0].length;

    // Find matching closing tag using balanced matching
    const closePos = findMatchingInvokeClosingTagRespectingParams(content, openTagEnd);

    if (closePos !== -1) {
      // Complete invoke block
      const innerContent = content.slice(openTagEnd, closePos);
      const fullMatch = content.slice(match.index, closePos + closeTag.length);
      blocks.push({ toolName, innerContent, fullMatch, isClosed: true });
      
      // CRITICAL: Skip past this entire invoke block to avoid finding nested invokes
      // inside parameter values (e.g., tool syntax inside write_to_file content)
      invokeOpenRegex.lastIndex = closePos + closeTag.length;
    } else {
      // No closing tag for THIS invoke - partial content for streaming.
      // We still return a block so the UI can show a pending/streaming tool,
      // but mark it as not closed so status stays in "pending" while content streams.
      blocks.push({
        toolName,
        innerContent: content.slice(openTagEnd),
        fullMatch: content.slice(match.index),
        isClosed: false,
      });
      break; // Stop at first incomplete block
    }
  }

  return blocks;
}

/**
 * Find matching closing tag for invoke using balanced tag counting
 * Respects parameter boundaries - ignores invoke tags inside parameter values
 */
function findMatchingInvokeClosingTagRespectingParams(content: string, openTagEnd: number): number {
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
function findMatchingFunctionCallsClose(content: string, openTagEnd: number): number {
  return findMatchingClosingTag(content, openTagEnd, '<function_calls>', '</function_calls>');
}

/**
 * Find the next tool block start position (function_calls tag)
 * Skips tags that are preceded by backticks (inside code blocks)
 */
function findNextToolStart(content: string, fromPosition: number): number {
  const tag = '<function_calls>';
  let inFence = false;

  for (let i = 0; i < content.length; ) {
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
function findNextMermaidStart(content: string, fromPosition: number): number {
  const pos = content.indexOf('```mermaid', fromPosition);
  return pos !== -1 ? pos : -1;
}

/**
 * Find the closing ``` for a mermaid block
 */
function findMermaidClose(content: string, afterMermaidTag: number): number {
  const pos = content.indexOf('```', afterMermaidTag);
  return pos !== -1 ? pos : -1;
}

/**
 * Tokenize content into stable segments (think blocks, tool blocks, and text)
 * Process sequentially to avoid parsing content inside think blocks
 */
export function tokenizeContent(content: string, messageId: string = 'unknown'): ContentToken[] {
  const tokens: ContentToken[] = [];
  let position = 0;
  let tokenIndex = 0;
  let toolIndex = 0;

  while (position < content.length) {
    // Check for think/thinking blocks, tool blocks, and mermaid blocks
    const thinkStart = content.indexOf('<think>', position);
    const thinkingStart = content.indexOf('<thinking>', position);
    const toolStart = findNextToolStart(content, position);
    const mermaidStart = findNextMermaidStart(content, position);

    // Determine which comes first
    let nextBlockStart = -1;
    let blockType: 'think' | 'thinking' | 'tool' | 'mermaid' | null = null;

    // Find the earliest block
    const candidates = [
      { pos: thinkStart, type: 'think' as const },
      { pos: thinkingStart, type: 'thinking' as const },
      { pos: toolStart, type: 'tool' as const },
      { pos: mermaidStart, type: 'mermaid' as const }
    ].filter(c => c.pos !== -1);

    if (candidates.length > 0) {
      const earliest = candidates.reduce((min, curr) => curr.pos < min.pos ? curr : min);
      nextBlockStart = earliest.pos;
      blockType = earliest.type;
    }

    // Add text before next block
    if (nextBlockStart !== -1 && nextBlockStart > position) {
      const textContent = content.slice(position, nextBlockStart);

      if (textContent) {
        tokens.push({
          type: 'text',
          content: textContent,
          index: tokenIndex++
        });
      }
      position = nextBlockStart;
    }

    // Process think block
    if (blockType === 'think') {
      const contentStart = thinkStart + 7; // length of '<think>'
      const closeTag = content.indexOf('</think>', contentStart);

      if (closeTag !== -1) {
        // Closed think block
        const thinkContent = content.slice(contentStart, closeTag);
        tokens.push({
          type: 'think',
          content: thinkContent,
          index: tokenIndex++,
          isClosed: true
        });
        position = closeTag + 8; // Skip past '</think>'
      } else {
        // Unclosed think block (streaming)
        const thinkContent = content.slice(contentStart);
        tokens.push({
          type: 'think',
          content: thinkContent,
          index: tokenIndex++,
          isClosed: false
        });
        position = content.length;
        break;
      }
    }
    // Process thinking block
    else if (blockType === 'thinking') {
      const contentStart = thinkingStart + 10; // length of '<thinking>'
      const closeTag = content.indexOf('</thinking>', contentStart);

      if (closeTag !== -1) {
        // Closed thinking block
        const thinkContent = content.slice(contentStart, closeTag);
        tokens.push({
          type: 'think',
          content: thinkContent,
          index: tokenIndex++,
          isClosed: true
        });
        position = closeTag + 11; // Skip past '</thinking>'
      } else {
        // Unclosed thinking block (streaming)
        const thinkContent = content.slice(contentStart);
        tokens.push({
          type: 'think',
          content: thinkContent,
          index: tokenIndex++,
          isClosed: false
        });
        position = content.length;
        break;
      }
    }
    // Process tool block
    else if (blockType === 'tool') {
      const openingTag = '<function_calls>';
      const closingTag = '</function_calls>';

      const contentStart = toolStart + openingTag.length;
      // Use balanced matching to find the correct closing tag
      const closeMarker = findMatchingFunctionCallsClose(content, contentStart);

      if (closeMarker !== -1) {
        // Closed tool block - extract ALL invoke blocks from this function_calls
        const innerContent = content.slice(contentStart, closeMarker);
        const closingTagLength = closingTag.length;
        const rawContent = content.slice(toolStart, closeMarker + closingTagLength);

        try {
          // Extract ALL invoke blocks using balanced matching
          const invokeBlocks = extractAllInvokeBlocks(innerContent);
          
          if (invokeBlocks.length > 0) {
            // Create a token for each invoke block
            for (const invokeBlock of invokeBlocks) {
              const { toolName, innerContent: invokeContent, fullMatch, isClosed } = invokeBlock;
              const parameters = parseXMLParameters(invokeContent);

              // Allow all tool names - validation happens at execution time
              if (toolName && typeof toolName === 'string') {
                const execId = `${messageId}-tool-${toolIndex++}`;
                tokens.push({
                  type: 'tool',
                  toolName,
                  parameters,
                  rawContent: `<function_calls>${fullMatch}</function_calls>`, // Wrap individual invoke in function_calls for consistency
                  index: tokenIndex++,
                  isClosed,
                  toolExecutionId: execId
                });
              }
            }
          } else {
            // Fallback for cases where </function_calls> is present but </invoke> has not streamed yet
            const partialInvokeMatch = innerContent.match(/<invoke\s+name=["']([^"']+)["']>/);
            if (partialInvokeMatch) {
              const toolName = partialInvokeMatch[1];
              const invokeContentStart = partialInvokeMatch.index! + partialInvokeMatch[0].length;
              const partialInvokeContent = innerContent.slice(invokeContentStart);
              const parameters = parseXMLParameters(partialInvokeContent);

              if (toolName && typeof toolName === 'string') {
                tokens.push({
                  type: 'tool',
                  toolName,
                  parameters,
                  rawContent,
                  index: tokenIndex++,
                  // Mark as not fully closed so streaming-aware UI (e.g. planning tools) can special-case it
                  isClosed: false,
                  toolExecutionId: `${messageId}-tool-${toolIndex++}`
                });
              }
            }
          }
          position = closeMarker + closingTagLength;
        } catch {
          // XML parsing failed but block is closed. Skip this block.
          position = closeMarker + closingTagLength;
        }
      } else {
        // Unclosed tool block (streaming) - extract all complete invoke blocks + partial last one
        const innerContent = content.slice(contentStart);
        const rawContent = content.slice(toolStart);

        try {
          // Extract all invoke blocks (complete ones + partial last one)
          const invokeBlocks = extractAllInvokeBlocks(innerContent);
          
          if (invokeBlocks.length > 0) {
            // Create tokens for all invoke blocks found
            for (const invokeBlock of invokeBlocks) {
              const { toolName, innerContent: invokeContent, fullMatch, isClosed } = invokeBlock;
              const parameters = parseXMLParameters(invokeContent);

              if (toolName && typeof toolName === 'string') {
                tokens.push({
                  type: 'tool',
                  toolName,
                  parameters,
                  rawContent: isClosed ? `<function_calls>${fullMatch}</function_calls>` : rawContent,
                  index: tokenIndex++,
                  isClosed,
                  toolExecutionId: `${messageId}-tool-${toolIndex++}`
                });
              }
            }
          } else {
            // Try to extract partial invoke opening tag for streaming
            const partialInvokeMatch = innerContent.match(/<invoke\s+name=["']([^"']+)["']>/);
            if (partialInvokeMatch) {
              const toolName = partialInvokeMatch[1];
              const invokeContentStart = partialInvokeMatch.index! + partialInvokeMatch[0].length;
              const partialInvokeContent = innerContent.slice(invokeContentStart);
              const parameters = parseXMLParameters(partialInvokeContent);

              if (toolName && typeof toolName === 'string') {
                tokens.push({
                  type: 'tool',
                  toolName,
                  parameters,
                  rawContent,
                  index: tokenIndex++,
                  isClosed: false,
                  toolExecutionId: `${messageId}-tool-${toolIndex++}`
                });
              }
            }
          }
        } catch {
          // XML parsing failed during streaming. Skip this block.
        }
        position = content.length;
        break;
      }
    }
    // Process mermaid block
    else if (blockType === 'mermaid') {
      const contentStart = mermaidStart + 10; // length of '```mermaid'
      const closeTag = findMermaidClose(content, contentStart);

      if (closeTag !== -1) {
        // Closed mermaid block
        const mermaidContent = content.slice(contentStart, closeTag).trim();
        tokens.push({
          type: 'mermaid',
          content: mermaidContent,
          index: tokenIndex++,
          isClosed: true
        });
        position = closeTag + 3; // Skip past '```'
        // Skip trailing newline after closing ``` if present
        if (position < content.length && content[position] === '\n') {
          position++;
        }
      } else {
        // Unclosed mermaid block (streaming)
        const mermaidContent = content.slice(contentStart).trim();
        tokens.push({
          type: 'mermaid',
          content: mermaidContent,
          index: tokenIndex++,
          isClosed: false
        });
        position = content.length;
        break;
      }
    }
    // No more blocks
    else {
      let remainingText = content.slice(position);

      // Hide incomplete function_calls tag markers during streaming (e.g., "<", "<f", "<func", "<function_", etc.)
      // This prevents flashing when AI is still typing the opening tag
      // Check if remaining text ends with partial function_calls tag
      let hasIncompleteTag = false;
      const functionCallsTag = 'function_calls';

      if (remainingText.endsWith('<')) {
        hasIncompleteTag = true;
      } else {
        // Check for partial <function_calls>
        for (let i = 1; i <= functionCallsTag.length; i++) {
          const partial = `<${functionCallsTag.slice(0, i)}`;
          if (remainingText.endsWith(partial)) {
            hasIncompleteTag = true;
            break;
          }
        }
      }

      if (hasIncompleteTag) {
        // Find where the incomplete tag starts
        let cutPos = remainingText.length - 1;
        while (cutPos >= 0 && remainingText[cutPos] !== '<') {
          cutPos--;
        }
        if (cutPos >= 0) {
          remainingText = remainingText.slice(0, cutPos);
        }
      }

      if (remainingText) {
        tokens.push({
          type: 'text',
          content: remainingText,
          index: tokenIndex++
        });
      }
      break;
    }
  }

  return tokens;
}
