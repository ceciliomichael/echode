import type { ToolCall, ParsedToolBlock } from '../types/tool';

// Unescape XML entities back to original characters
function unescapeXml(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&'); // Must be last to avoid double-unescaping
}

/**
 * Find the matching closing tag for a given opening tag position
 * Uses balanced tag counting to handle nested content that may contain similar-looking tags
 * (e.g., HTML content with </script> inside a parameter)
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
 * Extract function_calls blocks using balanced tag matching
 * This properly handles nested content that may contain </function_calls> or </invoke> text
 */
function extractFunctionCallsBlocks(content: string): Array<{ innerContent: string; fullMatch: string; startIndex: number; endIndex: number }> {
  const blocks: Array<{ innerContent: string; fullMatch: string; startIndex: number; endIndex: number }> = [];
  const openTag = '<function_calls>';
  const closeTag = '</function_calls>';
  let searchPos = 0;
  
  while (searchPos < content.length) {
    const openPos = content.indexOf(openTag, searchPos);
    if (openPos === -1) break;
    
    const openTagEnd = openPos + openTag.length;
    const closePos = findMatchingClosingTag(content, openTagEnd, openTag, closeTag);
    
    if (closePos === -1) {
      // No matching closing tag - incomplete block
      break;
    }
    
    const innerContent = content.slice(openTagEnd, closePos);
    const fullMatch = content.slice(openPos, closePos + closeTag.length);
    
    blocks.push({
      innerContent,
      fullMatch,
      startIndex: openPos,
      endIndex: closePos + closeTag.length
    });
    
    searchPos = closePos + closeTag.length;
  }
  
  return blocks;
}

/**
 * Extract invoke blocks using balanced tag matching
 * Handles nested content that may contain </invoke> text (e.g., in HTML/code)
 */
function extractInvokeBlocks(content: string): Array<{ toolName: string; innerContent: string; fullMatch: string }> {
  const blocks: Array<{ toolName: string; innerContent: string; fullMatch: string }> = [];
  const invokeOpenRegex = /<invoke\s+name=["']([^"']+)["']>/g;
  const closeTag = '</invoke>';
  
  let match: RegExpExecArray | null;
  while ((match = invokeOpenRegex.exec(content)) !== null) {
    const toolName = match[1];
    const openTagEnd = match.index + match[0].length;
    
    // Find matching closing tag using balanced matching
    const closePos = findMatchingClosingTag(content, openTagEnd, '<invoke', closeTag);
    
    if (closePos !== -1) {
      const innerContent = content.slice(openTagEnd, closePos);
      const fullMatch = content.slice(match.index, closePos + closeTag.length);
      
      blocks.push({
        toolName,
        innerContent,
        fullMatch
      });
    }
  }
  
  return blocks;
}

// Legacy regex pattern kept for parseToolBlock backward compatibility
const TOOL_BLOCK_REGEX = /<function_calls>([\s\S]*?)<\/function_calls>/;

/**
 * Parse XML-style parameters from invoke block content
 * New format: <parameter name="paramName">value</parameter>
 * Supports both simple values and JSON values inside parameter tags
 * Also handles partial/unclosed tags during streaming
 */
function parseXMLParameters(content: string): Record<string, unknown> {
  const parameters: Record<string, unknown> = {};
  
  // First pass: Extract all COMPLETE parameter tags with name attribute
  // Format: <parameter name="paramName">value</parameter>
  const paramRegex = /<parameter\s+name=["']([^"']+)["']>([\s\S]*?)<\/parameter>/g;
  let match: RegExpExecArray | null;
  const processedParams = new Set<string>();
  
  while ((match = paramRegex.exec(content)) !== null) {
    const paramName = match[1];
    const paramValue = match[2];
    
    // Skip if already processed (handles duplicate tags)
    if (processedParams.has(paramName)) {
      continue;
    }
    
    // Don't trim for old_string/new_string/content/edits/diff/blocks - preserve exact whitespace for code
    const shouldPreserveWhitespace = ['old_string', 'new_string', 'content', 'edits', 'diff', 'blocks'].includes(paramName);
    // Strip only leading/trailing newlines (AI adds newline after opening tag), preserve internal whitespace
    const finalValue = shouldPreserveWhitespace 
      ? paramValue.replace(/^\n/, '').replace(/\n$/, '') 
      : paramValue.trim();
    
    // Unescape XML entities (e.g., from Ctrl+Enter echo_search with special chars)
    const unescapedValue = unescapeXml(finalValue);
    
    parameters[paramName] = parseParamValue(unescapedValue, shouldPreserveWhitespace);
    processedParams.add(paramName);
  }
  
  // Second pass: Extract PARTIAL/UNCLOSED parameter tags (streaming content)
  // Look for opening parameter tags that don't have closing tags
  const openingParamRegex = /<parameter\s+name=["']([^"']+)["']>/g;
  const openingTags: Array<{name: string; pos: number; fullMatch: string}> = [];
  
  while ((match = openingParamRegex.exec(content)) !== null) {
    openingTags.push({ 
      name: match[1], 
      pos: match.index + match[0].length,
      fullMatch: match[0]
    });
  }
  
  // Check each opening tag for unclosed content
  for (const tag of openingTags) {
    // Skip if we already have this parameter (it was complete)
    if (parameters[tag.name] !== undefined) {continue;}
    
    // Extract partial content from opening tag to end or next parameter tag
    const closingTag = '</parameter>';
    const closingPos = content.indexOf(closingTag, tag.pos);
    
    // If no closing tag found, this is a streaming parameter
    if (closingPos === -1) {
      const partialContent = content.slice(tag.pos);
      // Unescape XML entities for partial content too
      parameters[tag.name] = unescapeXml(partialContent);
    }
  }
  
  return parameters;
}

/**
 * Parse parameter value with type coercion
 * @param value - The string value to parse
 * @param isRawString - If true, return value as-is without any parsing (for code content)
 */
function parseParamValue(value: string, isRawString = false): unknown {
  // Raw string parameters (content, diff, etc.) should NEVER be parsed
  // They contain source code that may look like JSON but isn't
  if (isRawString) {
    return value;
  }
  
  const trimmedValue = value.trim();
  
  // Try to parse as JSON first (for arrays, objects, booleans, numbers)
  if (trimmedValue.startsWith('[') || trimmedValue.startsWith('{')) {
    try {
      return JSON.parse(trimmedValue);
    } catch {
      // If it's a partial array, try to extract complete objects
      if (trimmedValue.startsWith('[')) {
        const completeObjects = extractCompleteJsonObjects(trimmedValue);
        if (completeObjects.length > 0) {
          return completeObjects;
        }
      }
      // If JSON parse fails, treat as string
    }
  }
  
  // Handle newline-separated JSON objects (common AI output format)
  // Example: {"path": "file1.ts"}\n{"path": "file2.ts"}
  if (trimmedValue.includes('\n') && trimmedValue.includes('{')) {
    try {
      const lines = trimmedValue.split('\n').filter(line => line.trim());
      const objects = lines
        .map(line => {
          try {
            return JSON.parse(line.trim());
          } catch {
            return null;
          }
        })
        .filter(obj => obj !== null);
      
      // If we successfully parsed multiple objects, return as array
      if (objects.length > 1) {
        return objects;
      }
      // If only one object, try to parse the whole value as single JSON
      if (objects.length === 1 && lines.length === 1) {
        return objects[0];
      }
    } catch {
      // Fall through to other parsing methods
    }
  }
  
  // Handle boolean values
  if (trimmedValue === 'true') {return true;}
  if (trimmedValue === 'false') {return false;}
  
  // Handle numeric values
  if (trimmedValue && !isNaN(Number(trimmedValue))) {
    return Number(trimmedValue);
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
 * Detect nested tool-call XML inside a string (e.g., inside a parameter value)
 * Returns true if the content contains <function_calls> or <invoke tags
 */
function hasNestedToolCalls(content: string): boolean {
  if (typeof content !== 'string') {return false;}
  // Check for nested function_calls or invoke tags
  return /<function_calls>/.test(content) || /<invoke\s+name=/.test(content);
}

/**
 * Check all parameter values for nested tool-call XML
 * Returns true if any parameter contains nested tool calls
 */
function hasNestedToolCallsInParams(parameters: Record<string, unknown>): boolean {
  for (const value of Object.values(parameters)) {
    if (typeof value === 'string' && hasNestedToolCalls(value)) {
      return true;
    }
    // Check arrays (e.g., edits array)
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && hasNestedToolCalls(item)) {
          return true;
        }
        if (typeof item === 'object' && item !== null) {
          for (const subVal of Object.values(item)) {
            if (typeof subVal === 'string' && hasNestedToolCalls(subVal)) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

/**
 * Parse a single invoke block and return structured data
 * Extracts tool name from invoke tag attribute: <invoke name="TOOL_NAME">
 * Rejects tool calls with nested tool-call XML inside parameter values
 */
function parseInvokeBlock(
  invokeContent: string,
  toolName: string,
  rawContent: string,
): ParsedToolBlock | null {
  try {
    // Parse XML-style parameters from the invoke content
    const parameters = parseXMLParameters(invokeContent);

    // Reject if any parameter contains nested tool-call XML
    if (hasNestedToolCallsInParams(parameters)) {
      console.log(`[ToolParser] ⚠️ Rejected ${toolName}: nested tool-call XML detected in parameter value`);
      return null;
    }

    return {
      type: 'tool',
      toolName,
      parameters,
      rawContent,
    };
  } catch {
    return null;
  }
}

/**
 * Parse function_calls block and extract all invoke blocks
 * Returns array of parsed tool blocks
 * Uses balanced tag matching to handle nested content properly
 */
function parseFunctionCallsBlock(
  contentStr: string,
  rawContent: string,
): ParsedToolBlock[] {
  const toolBlocks: ParsedToolBlock[] = [];
  
  // Use balanced tag extraction instead of regex
  const invokeBlocks = extractInvokeBlocks(contentStr);
  
  for (const block of invokeBlocks) {
    if (block.toolName && typeof block.toolName === 'string') {
      const parsed = parseInvokeBlock(block.innerContent, block.toolName, rawContent);
      if (parsed) {
        toolBlocks.push(parsed);
      }
    }
  }
  
  return toolBlocks;
}

/**
 * Extracts tool calls from XML-style tool blocks
 * Format: <function_calls><invoke name="TOOL_NAME"><parameter name="param">value</parameter></invoke></function_calls>
 */
export function parseToolBlock(content: string): ParsedToolBlock | null {
  const match = content.match(new RegExp(`^${TOOL_BLOCK_REGEX.source}$`, 'm'));

  if (!match) {
    return null;
  }

  const innerContent = match[1];
  const toolBlocks = parseFunctionCallsBlock(innerContent, match[0]);
  
  // Return the first tool block (for single tool call compatibility)
  // Allow all tool names to pass through - validation happens at execution time
  return toolBlocks.length > 0 ? toolBlocks[0] : null;
}

/**
 * Creates a ToolCall object from parsed tool block
 */
export function createToolCall(parsed: ParsedToolBlock): ToolCall {
  return {
    toolName: parsed.toolName,
    parameters: parsed.parameters,
    status: 'pending',
  };
}

/**
 * Checks if content contains a complete tool block
 */
export function hasCompleteToolBlock(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Remove <think> and <thinking> blocks before checking for tool blocks
  let contentWithoutThinkBlocks = content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
  
  // Clean up AI formatting mistakes
  contentWithoutThinkBlocks = cleanToolCallContent(contentWithoutThinkBlocks);

  // Use extractToolBlocks to ensure we can actually parse complete tool blocks
  const toolBlocks = extractToolBlocks(contentWithoutThinkBlocks);

  return toolBlocks.length > 0;
}

/**
 * Trims content to only include up to the end of the last complete tool block
 * Uses balanced tag matching for proper nested content handling
 */
export function trimToLastCompleteToolBlock(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Remove <think> blocks before processing
  let contentWithoutThinkBlocks = content.replace(
    /<think>[\s\S]*?<\/think>/g,
    '',
  );
  
  // Clean up AI formatting mistakes
  contentWithoutThinkBlocks = cleanToolCallContent(contentWithoutThinkBlocks);

  // Find all complete tool blocks using balanced matching
  const functionCallsBlocks = extractFunctionCallsBlocks(contentWithoutThinkBlocks);

  if (functionCallsBlocks.length === 0) {
    return content;
  }

  // Get the last valid tool block
  let lastValidBlock: { endIndex: number } | null = null;
  
  for (const block of functionCallsBlocks) {
    const parsedBlocks = parseFunctionCallsBlock(block.innerContent, block.fullMatch);
    if (parsedBlocks.length > 0) {
      lastValidBlock = block;
    }
  }

  if (lastValidBlock) {
    // Find the corresponding position in the original content
    const originalBlocks = extractFunctionCallsBlocks(content);
    
    for (let i = originalBlocks.length - 1; i >= 0; i--) {
      const block = originalBlocks[i];
      const parsedBlocks = parseFunctionCallsBlock(block.innerContent, block.fullMatch);
      if (parsedBlocks.length > 0) {
        return content.slice(0, block.endIndex);
      }
    }
  }

  return content;
}

/**
 * Trims content to only include up to the end of the FIRST complete tool block
 * Useful for incremental tool execution
 * Uses balanced tag matching for proper nested content handling
 */
export function trimToFirstCompleteToolBlock(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Remove <think> blocks before processing
  let contentWithoutThinkBlocks = content.replace(
    /<think>[\s\S]*?<\/think>/g,
    '',
  );
  
  // Clean up AI formatting mistakes
  contentWithoutThinkBlocks = cleanToolCallContent(contentWithoutThinkBlocks);

  // Find first valid tool block using balanced matching
  const functionCallsBlocks = extractFunctionCallsBlocks(contentWithoutThinkBlocks);
  
  for (const block of functionCallsBlocks) {
    const parsedBlocks = parseFunctionCallsBlock(block.innerContent, block.fullMatch);
    if (parsedBlocks.length > 0) {
      // Found a valid tool - map back to original content
      const originalBlocks = extractFunctionCallsBlocks(content);
      
      for (const origBlock of originalBlocks) {
        const originalParsedBlocks = parseFunctionCallsBlock(origBlock.innerContent, origBlock.fullMatch);
        if (originalParsedBlocks.length > 0) {
          return content.slice(0, origBlock.endIndex);
        }
      }
      break;
    }
  }

  return content;
}

/**
 * Clean up common AI mistakes in tool call formatting
 * Handles cases like duplicate opening tags: <function_calls><function_calls>
 */
function cleanToolCallContent(content: string): string {
  let cleaned = content;
  let hadErrors = false;
  
  // Remove duplicate opening <function_calls> tags
  // Pattern: <function_calls>\s*<function_calls> -> <function_calls>
  const duplicateOpenings = cleaned.match(/<function_calls>\s*<function_calls>/g);
  if (duplicateOpenings) {
    console.log(`[ToolParser] 🔧 Fixed ${duplicateOpenings.length} duplicate opening tag(s)`);
    hadErrors = true;
    cleaned = cleaned.replace(
      /<function_calls>\s*<function_calls>/g,
      '<function_calls>'
    );
  }
  
  // Remove duplicate closing </function_calls> tags
  const duplicateClosings = cleaned.match(/<\/function_calls>\s*<\/function_calls>/g);
  if (duplicateClosings) {
    console.log(`[ToolParser] 🔧 Fixed ${duplicateClosings.length} duplicate closing tag(s)`);
    hadErrors = true;
    cleaned = cleaned.replace(
      /<\/function_calls>\s*<\/function_calls>/g,
      '</function_calls>'
    );
  }
  
  // Fix cases where AI forgot to close previous tag and opened a new one
  // Pattern: <function_calls>...(no closing tag)...<function_calls> -> </function_calls><function_calls>
  // Look for: <function_calls>...content...<function_calls> where middle content has <invoke
  let unclosedFixed = 0;
  cleaned = cleaned.replace(
    /(<function_calls>[\s\S]*?<invoke[\s\S]*?<\/invoke>[\s\S]*?)(<function_calls>)/g,
    (match, firstBlock, secondTag) => {
      // Check if firstBlock already has a closing tag
      if (firstBlock.includes('</function_calls>')) {
        return match; // Already properly closed
      }
      // Add closing tag before opening new one
      unclosedFixed++;
      return firstBlock + '</function_calls>\n' + secondTag;
    }
  );
  
  if (unclosedFixed > 0) {
    console.log(`[ToolParser] 🔧 Fixed ${unclosedFixed} unclosed tag(s) before new opening`);
    hadErrors = true;
  }
  
  // Fix malformed closing tags with backslashes: <\param> -> </param>
  // This catches the specific error where AI uses <\path1> instead of </path1>
  const backslashClosings = cleaned.match(/<\\[\w_-]+>/g);
  if (backslashClosings) {
    console.log(`[ToolParser] 🔧 Fixed ${backslashClosings.length} backslash closing tag(s) (e.g., <\\path1> -> </path1>)`);
    hadErrors = true;
    cleaned = cleaned.replace(
      /<\\([\w_-]+)>/g,
      '</$1>'
    );
  }
  
  // Fix malformed invoke tags: <invoke name= without proper closing
  // Some AI models may format the invoke tag incorrectly
  const malformedInvokes = cleaned.match(/<invoke\s+name=["'][^"']+["']\s*[^>]*(?!>)/g);
  if (malformedInvokes) {
    console.log(`[ToolParser] 🔧 Fixed ${malformedInvokes.length} malformed invoke tag(s)`);
    hadErrors = true;
  }
  
  if (hadErrors) {
    console.log('[ToolParser] ⚠️  AI generated malformed XML - automatically corrected');
  }
  
  return cleaned;
}

/**
 * Extracts all complete tool blocks from content
 * Excludes tool blocks that are inside <think> tags
 * Uses balanced tag matching to handle nested content (e.g., HTML with </script>)
 */
export function extractToolBlocks(content: string): ParsedToolBlock[] {
  // Remove all <think>...</think> blocks to prevent tool execution inside them
  let contentWithoutThinkBlocks = content.replace(
    /<think>[\s\S]*?<\/think>/g,
    '',
  );
  
  // Clean up common AI formatting mistakes
  contentWithoutThinkBlocks = cleanToolCallContent(contentWithoutThinkBlocks);

  const toolBlocks: ParsedToolBlock[] = [];
  
  // Use balanced tag extraction instead of regex for proper nested content handling
  const functionCallsBlocks = extractFunctionCallsBlocks(contentWithoutThinkBlocks);
  
  for (const block of functionCallsBlocks) {
    const parsedBlocks = parseFunctionCallsBlock(block.innerContent, block.fullMatch);
    
    // Add all parsed invoke blocks
    toolBlocks.push(...parsedBlocks);
  }

  return toolBlocks;
}

/**
 * Extract the first tool block from content
 */
export function extractFirstToolBlock(content: string): ParsedToolBlock | null {
  const blocks = extractToolBlocks(content);
  return blocks.length > 0 ? blocks[0] : null;
}

/**
 * Check if a tool is parallelizable (read-only, non-blocking)
 */
export function isParallelizableTool(toolName: string): boolean {
  const parallelizableTools = [
    'read_file',
    'list_files',
    'grep_search',
    'glob_search',
    'todo_read',
  ];
  return parallelizableTools.includes(toolName);
}

/**
 * Extract multiple consecutive parallelizable tool blocks from the start of content
 * Stops when encountering a non-parallelizable tool or non-tool content
 */
export function extractParallelizableToolBlocks(content: string): ParsedToolBlock[] {
  const allBlocks = extractToolBlocks(content);
  const parallelBlocks: ParsedToolBlock[] = [];
  
  // Find the position of the first tool block
  if (allBlocks.length === 0) {
    return [];
  }
  
  // Check if content starts with tool blocks (allowing whitespace)
  const trimmedContent = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const startsWithToolBlock = trimmedContent.startsWith('<function_calls>');
  
  if (!startsWithToolBlock) {
    // If content doesn't start with a tool block, only execute first tool
    return allBlocks.length > 0 && isParallelizableTool(allBlocks[0].toolName) 
      ? [allBlocks[0]] 
      : [];
  }
  
  // Extract consecutive parallelizable tool blocks from the start
  for (const block of allBlocks) {
    if (!isParallelizableTool(block.toolName)) {
      // Stop at the first non-parallelizable tool
      break;
    }
    
    // Check if this block is consecutive (no non-tool content between blocks)
    if (parallelBlocks.length > 0) {
      const lastBlock = parallelBlocks[parallelBlocks.length - 1];
      const lastBlockEnd = content.indexOf(lastBlock.rawContent) + lastBlock.rawContent.length;
      const currentBlockStart = content.indexOf(block.rawContent);
      const contentBetween = content.slice(lastBlockEnd, currentBlockStart).trim();
      
      // If there's non-whitespace content between blocks, stop
      if (contentBetween.length > 0) {
        break;
      }
    }
    
    parallelBlocks.push(block);
  }
  
  return parallelBlocks;
}
