/**
 * Content tokenization for stable rendering during streaming
 */

export type ContentToken =
  | { type: 'think'; content: string; index: number; isClosed: boolean }
  | { type: 'tool'; toolName: string; parameters: Record<string, unknown>; rawContent: string; index: number; isClosed: boolean; toolExecutionId: string }
  | { type: 'text'; content: string; index: number };

/**
 * Valid tool names for detection
 */
const VALID_TOOL_NAMES = ['read_file', 'write_to_file', 'list_files', 'grep_search', 'glob_search', 'delete_file', 'edit_file', 'multi_edit', 'todo_write', 'todo_read', 'apply_diff'];

/**
 * Parse XML-style parameters from tool block content
 * Handles both complete and partial/unclosed tags during streaming
 */
function parseXMLParameters(content: string): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  
  // First pass: Extract all COMPLETE parameter tags (with closing tags)
  // Use greedy match to handle cases where content contains the closing tag string
  const completeParamRegex = /<([\w_-]+)>([\s\S]*)<\/\1>/g;
  let match: RegExpExecArray | null;
  
  while ((match = completeParamRegex.exec(content)) !== null) {
    const paramName = match[1];
    // Don't trim for old_string/new_string/content/edits - preserve exact whitespace for code
    const shouldPreserveWhitespace = ['old_string', 'new_string', 'content', 'edits'].includes(paramName);
    const paramValue = shouldPreserveWhitespace ? match[2] : match[2].trim();
    parameters[paramName] = parseParamValue(paramValue);
  }
  
  // Second pass: Extract PARTIAL/UNCLOSED tags (streaming content)
  const openingTagRegex = /<([\w_-]+)>/g;
  const openingTags: Array<{name: string; pos: number}> = [];
  
  while ((match = openingTagRegex.exec(content)) !== null) {
    openingTags.push({ name: match[1], pos: match.index + match[0].length });
  }
  
  // Check each opening tag for unclosed content
  for (const tag of openingTags) {
    // Skip if we already have this parameter (it was complete)
    if (parameters[tag.name] !== undefined) continue;
    
    // Extract partial content from opening tag
    const closingTag = `</${tag.name}>`;
    const closingPos = content.indexOf(closingTag, tag.pos);
    
    // If no closing tag found, this is streaming content
    if (closingPos === -1) {
      const partialContent = content.slice(tag.pos);
      parameters[tag.name] = partialContent;
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
  if (value === 'true') return true;
  if (value === 'false') return false;
  
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
      if (depth === 0) objStart = i;
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
 * Find the next tool block start position (function_call tag)
 */
function findNextToolStart(content: string, fromPosition: number): number {
  const pos = content.indexOf('<function_call>', fromPosition);
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
    // Check for think/thinking blocks and tool blocks
    const thinkStart = content.indexOf('<think>', position);
    const thinkingStart = content.indexOf('<thinking>', position);
    const toolStart = findNextToolStart(content, position);
    
    // Determine which comes first
    let nextBlockStart = -1;
    let blockType: 'think' | 'thinking' | 'tool' | null = null;
    
    // Find the earliest block
    const candidates = [
      { pos: thinkStart, type: 'think' as const },
      { pos: thinkingStart, type: 'thinking' as const },
      { pos: toolStart, type: 'tool' as const }
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
      const openingTag = '<function_call>';
      const closingTag = '</function_call>';
      
      const contentStart = toolStart + openingTag.length;
      const closeMarker = content.indexOf(closingTag, contentStart);
      
      if (closeMarker !== -1) {
        // Closed tool block
        const innerContent = content.slice(contentStart, closeMarker);
        const closingTagLength = closingTag.length;
        const rawContent = content.slice(toolStart, closeMarker + closingTagLength);
        
        try {
          const parameters = parseXMLParameters(innerContent);
          const toolName = parameters.tool_name as string;
          
          if (toolName && typeof toolName === 'string' && VALID_TOOL_NAMES.includes(toolName)) {
            // Remove tool_name from parameters
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { tool_name, ...actualParameters } = parameters;
            
            // Special handling for read_file with files array
            if (toolName === 'read_file' && actualParameters.files && Array.isArray(actualParameters.files)) {
              // Create individual tool tokens for each file in the array
              (actualParameters.files as Array<unknown>).forEach((file: unknown, fileIdx: number) => {
                if (typeof file === 'object' && file !== null && 'path' in file) {
                  tokens.push({
                    type: 'tool',
                    toolName,
                    parameters: { path: (file as { path: string }).path, ...(file as Record<string, unknown>) },
                    rawContent: `<function_call><tool_name>${toolName}</tool_name><path>${(file as { path: string }).path}</path></function_call>`,
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
                parameters: actualParameters,
                rawContent,
                index: tokenIndex++,
                isClosed: true,
                toolExecutionId: `${messageId}-tool-${toolIndex++}`
              });
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
          const parameters = parseXMLParameters(innerContent);
          const toolName = parameters.tool_name as string;
          
          if (toolName && typeof toolName === 'string' && VALID_TOOL_NAMES.includes(toolName)) {
            // Remove tool_name from parameters
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { tool_name, ...actualParameters } = parameters;
            
            // Special handling for read_file with files array during streaming
            if (toolName === 'read_file' && actualParameters.files && Array.isArray(actualParameters.files)) {
              // Create individual tool tokens for each complete file in the array
              (actualParameters.files as Array<unknown>).forEach((file: unknown, fileIdx: number) => {
                if (typeof file === 'object' && file !== null && 'path' in file) {
                  tokens.push({
                    type: 'tool',
                    toolName,
                    parameters: { path: (file as { path: string }).path, ...(file as Record<string, unknown>) },
                    rawContent: `<function_call><tool_name>${toolName}</tool_name><path>${(file as { path: string }).path}</path></function_call>`,
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
                parameters: actualParameters,
                rawContent,
                index: tokenIndex++,
                isClosed: false,
                toolExecutionId: `${messageId}-tool-${toolIndex++}`
              });
            }
          }
        } catch {
          // XML parsing failed during streaming. Skip this block.
        }
        position = content.length;
        break;
      }
    }
    // No more blocks
    else {
      let remainingText = content.slice(position);
      
      // Hide incomplete function_call tag markers during streaming (e.g., "<", "<f", "<func", "<function", etc.)
      // This prevents flashing when AI is still typing the opening tag
      // Check if remaining text ends with partial function_call tag
      let hasIncompleteTag = false;
      const functionCallTag = 'function_call';
      
      if (remainingText.endsWith('<')) {
        hasIncompleteTag = true;
      } else {
        // Check for partial <function_call>
        for (let i = 1; i <= functionCallTag.length; i++) {
          const partial = `<${functionCallTag.slice(0, i)}`;
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
