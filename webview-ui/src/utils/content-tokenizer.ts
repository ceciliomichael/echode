/**
 * Content tokenization for stable rendering during streaming
 */

export type ContentToken =
  | { type: 'think'; content: string; index: number; isClosed: boolean }
  | { type: 'tool'; toolName: string; parameters: Record<string, unknown>; rawContent: string; index: number; isClosed: boolean; toolExecutionId: string }
  | { type: 'mermaid'; content: string; index: number; isClosed: boolean }
  | { type: 'text'; content: string; index: number };

/**
 * Find the matching closing tag for a given opening tag position
 * Uses balanced tag counting to handle nested content that may contain similar-looking tags
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
      // Found another opening tag first - increase depth
      depth++;
      pos = nextOpen + openTag.length;
    } else {
      // Found closing tag first - decrease depth
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
    const closeTag = '</parameter>';
    const closePos = findMatchingClosingTag(content, openTagEnd, '<parameter', closeTag);
    
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
  if (value === 'true') {return true;}
  if (value === 'false') {return false;}
  
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
      if (depth === 0) {objStart = i;}
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
 * Extract invoke blocks using balanced tag matching
 * Handles nested content that may contain </invoke> text (e.g., in HTML/code)
 */
function extractInvokeBlock(content: string): { toolName: string; innerContent: string } | null {
  const invokeOpenRegex = /<invoke\s+name=["']([^"']+)["']>/;
  const match = invokeOpenRegex.exec(content);
  
  if (!match) {
    return null;
  }
  
  const toolName = match[1];
  const openTagEnd = match.index + match[0].length;
  const closeTag = '</invoke>';
  
  // Find matching closing tag using balanced matching
  const closePos = findMatchingClosingTag(content, openTagEnd, '<invoke', closeTag);
  
  if (closePos !== -1) {
    const innerContent = content.slice(openTagEnd, closePos);
    return { toolName, innerContent };
  }
  
  // No closing tag - return partial content for streaming
  return { toolName, innerContent: content.slice(openTagEnd) };
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
 */
function findNextToolStart(content: string, fromPosition: number): number {
  const pos = content.indexOf('<function_calls>', fromPosition);
  return pos !== -1 ? pos : -1;
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
        // Closed tool block
        const innerContent = content.slice(contentStart, closeMarker);
        const closingTagLength = closingTag.length;
        const rawContent = content.slice(toolStart, closeMarker + closingTagLength);
        
        try {
          // Extract invoke block with tool name using balanced matching
          const invokeResult = extractInvokeBlock(innerContent);
          if (invokeResult) {
            const { toolName, innerContent: invokeContent } = invokeResult;
            const parameters = parseXMLParameters(invokeContent);
            
            // Allow all tool names - validation happens at execution time
            if (toolName && typeof toolName === 'string') {
              // Special handling for read_file with files array
              if (toolName === 'read_file' && parameters.files && Array.isArray(parameters.files)) {
                // Create individual tool tokens for each file in the array
                (parameters.files as Array<unknown>).forEach((file: unknown, fileIdx: number) => {
                  if (typeof file === 'object' && file !== null && 'path' in file) {
                    tokens.push({
                      type: 'tool',
                      toolName,
                      parameters: { path: (file as { path: string }).path, ...(file as Record<string, unknown>) },
                      rawContent: `<function_calls><invoke name="${toolName}"><parameter name="path">${(file as { path: string }).path}</parameter></invoke></function_calls>` ,
                      index: tokenIndex++,
                      isClosed: true,
                      toolExecutionId: `${messageId}-tool-${toolIndex}-file-${fileIdx}`
                    });
                  }
                });
                toolIndex++;
              } else {
                // Regular single tool token
                tokens.push({
                  type: 'tool',
                  toolName,
                  parameters,
                  rawContent,
                  index: tokenIndex++,
                  isClosed: true,
                  toolExecutionId: `${messageId}-tool-${toolIndex++}`
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
        // Unclosed tool block (streaming)
        const innerContent = content.slice(contentStart);
        const rawContent = content.slice(toolStart);
        
        try {
          // Try to extract invoke block using balanced matching (may be partial during streaming)
          const invokeResult = extractInvokeBlock(innerContent);
          if (invokeResult) {
            const { toolName, innerContent: invokeContent } = invokeResult;
            const parameters = parseXMLParameters(invokeContent);
            
            // Allow all tool names - validation happens at execution time
            if (toolName && typeof toolName === 'string') {
              // Special handling for read_file with files array during streaming
              if (toolName === 'read_file' && parameters.files && Array.isArray(parameters.files)) {
                // Create individual tool tokens for each complete file in the array
                (parameters.files as Array<unknown>).forEach((file: unknown, fileIdx: number) => {
                  if (typeof file === 'object' && file !== null && 'path' in file) {
                    tokens.push({
                      type: 'tool',
                      toolName,
                      parameters: { path: (file as { path: string }).path, ...(file as Record<string, unknown>) },
                      rawContent: `<function_calls><invoke name="${toolName}"><parameter name="path">${(file as { path: string }).path}</parameter></invoke></function_calls>`,
                      index: tokenIndex++,
                      isClosed: false,
                      toolExecutionId: `${messageId}-tool-${toolIndex}-file-${fileIdx}`
                    });
                  }
                });
                toolIndex++;
              } else {
                // Regular single tool token
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
