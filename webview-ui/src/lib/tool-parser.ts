import type { ToolCall, ParsedToolBlock } from '../types/tool';

/**
 * Valid tool names - used to distinguish tool blocks from parameter tags
 */
const VALID_TOOL_NAMES = new Set([
  'read_file',
  'write_to_file',
  'list_files',
  'grep_search',
  'glob_search',
  'delete_file',
  'edit_file',
  'multi_edit',
  'todo_write',
  'todo_read',
  'apply_diff'
]);

/**
 * Centralized regex pattern for tool blocks
 * Format: <function_call><tool_name>TOOL_NAME</tool_name><param>value</param>...</function_call>
 * 
 * Pattern breakdown:
 * - <function_call> - Opening tag
 * - ([\s\S]*?) - Non-greedy content capture (tool name + parameters)
 * - </function_call> - Closing tag
 */
const TOOL_BLOCK_REGEX = /<function_call>([\s\S]*?)<\/function_call>/;
const TOOL_BLOCK_REGEX_GLOBAL = /<function_call>([\s\S]*?)<\/function_call>/g;

/**
 * Parse XML-style parameters from tool block content
 * Supports both simple values and JSON values inside parameter tags
 * Also handles partial/unclosed tags during streaming
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
    parameters[paramName] = parseParamValue(paramValue, shouldPreserveWhitespace);
  }
  
  // Second pass: Extract PARTIAL/UNCLOSED tags (streaming content)
  // Find opening tags that don't have corresponding closing tags
  const openingTagRegex = /<([\w_-]+)>/g;
  const openingTags: Array<{name: string; pos: number}> = [];
  
  while ((match = openingTagRegex.exec(content)) !== null) {
    openingTags.push({ name: match[1], pos: match.index + match[0].length });
  }
  
  // Check each opening tag for unclosed content
  for (const tag of openingTags) {
    // Skip if we already have this parameter (it was complete)
    if (parameters[tag.name] !== undefined) continue;
    
    // Extract partial content from opening tag to end or next opening tag
    const closingTag = `</${tag.name}>`;
    const closingPos = content.indexOf(closingTag, tag.pos);
    
    // If no closing tag found, this is a streaming parameter
    if (closingPos === -1) {
      const partialContent = content.slice(tag.pos);
      parameters[tag.name] = partialContent; // Keep as raw string during streaming
    }
  }
  
  return parameters;
}

/**
 * Parse parameter value with type coercion
 */
function parseParamValue(value: string, preserveWhitespace = false): unknown {
  const trimmedValue = preserveWhitespace ? value : value.trim();
  
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
  if (trimmedValue === 'true') return true;
  if (trimmedValue === 'false') return false;
  
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
 * Parse a single tool block and return structured data
 */
function parseToolBlockInternal(
  contentStr: string,
  rawContent: string,
): ParsedToolBlock | null {
  try {
    // Parse XML-style parameters from the content
    const parameters = parseXMLParameters(contentStr);
    
    // Extract tool_name from parameters
    const toolName = parameters.tool_name as string;
    if (!toolName || typeof toolName !== 'string') {
      return null;
    }
    
    // Remove tool_name from parameters as it's metadata
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tool_name, ...actualParameters } = parameters;

    return {
      type: 'tool',
      toolName,
      parameters: actualParameters,
      rawContent,
    };
  } catch {
    return null;
  }
}

/**
 * Extracts tool calls from XML-style tool blocks
 * Format: <function_call><tool_name>TOOL_NAME</tool_name><param>value</param></function_call>
 */
export function parseToolBlock(content: string): ParsedToolBlock | null {
  const match = content.match(new RegExp(`^${TOOL_BLOCK_REGEX.source}$`, 'm'));

  if (!match) {
    return null;
  }

  const innerContent = match[1];
  const parsed = parseToolBlockInternal(innerContent, match[0]);
  
  // Validate this is a real tool name
  if (parsed && !VALID_TOOL_NAMES.has(parsed.toolName)) {
    return null;
  }

  return parsed;
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

  // Find all complete tool blocks
  const toolBlocks = extractToolBlocks(contentWithoutThinkBlocks);

  if (toolBlocks.length === 0) {
    return content;
  }

  // Find the position of the end of the last complete tool block
  let lastToolBlockEnd = -1;
  const regex = new RegExp(TOOL_BLOCK_REGEX_GLOBAL.source, 'g');
  let match: RegExpExecArray | null;

  regex.lastIndex = 0;
  match = regex.exec(contentWithoutThinkBlocks);
  while (match !== null) {
    // Parse and validate tool name
    const parsed = parseToolBlockInternal(match[1], match[0]);
    if (parsed && VALID_TOOL_NAMES.has(parsed.toolName)) {
      lastToolBlockEnd = match.index + match[0].length;
    }
    match = regex.exec(contentWithoutThinkBlocks);
  }

  if (lastToolBlockEnd > 0) {
    // Find the last tool block in the original content
    const originalMatches: Array<{ index: number; length: number }> = [];
    const originalRegex = new RegExp(TOOL_BLOCK_REGEX_GLOBAL.source, 'g');
    let originalMatch: RegExpExecArray | null;

    originalRegex.lastIndex = 0;
    originalMatch = originalRegex.exec(content);
    while (originalMatch !== null) {
      // Parse to validate tool name
      const parsed = parseToolBlockInternal(originalMatch[1], originalMatch[0]);
      if (parsed && VALID_TOOL_NAMES.has(parsed.toolName)) {
        originalMatches.push({
          index: originalMatch.index,
          length: originalMatch[0].length,
        });
      }
      originalMatch = originalRegex.exec(content);
    }

    if (originalMatches.length > 0) {
      const lastMatch = originalMatches[originalMatches.length - 1];
      return content.slice(0, lastMatch.index + lastMatch.length);
    }
  }

  return content;
}

/**
 * Trims content to only include up to the end of the FIRST complete tool block
 * Useful for incremental tool execution
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

  // Find first valid tool block
  const regex = new RegExp(TOOL_BLOCK_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  
  regex.lastIndex = 0;
  match = regex.exec(contentWithoutThinkBlocks);
  
  while (match !== null) {
    const parsed = parseToolBlockInternal(match[1], match[0]);
    if (parsed && VALID_TOOL_NAMES.has(parsed.toolName)) {
      // Found a valid tool - map back to original content
      const originalRegex = new RegExp(TOOL_BLOCK_REGEX.source, 'g');
      let originalMatch: RegExpExecArray | null;
      
      originalRegex.lastIndex = 0;
      originalMatch = originalRegex.exec(content);
      
      while (originalMatch !== null) {
        const originalParsed = parseToolBlockInternal(originalMatch[1], originalMatch[0]);
        if (originalParsed && VALID_TOOL_NAMES.has(originalParsed.toolName)) {
          return content.slice(0, originalMatch.index + originalMatch[0].length);
        }
        originalMatch = originalRegex.exec(content);
      }
      break;
    }
    match = regex.exec(contentWithoutThinkBlocks);
  }

  return content;
}

/**
 * Clean up common AI mistakes in tool call formatting
 * Handles cases like duplicate opening tags: <function_call><function_call>
 */
function cleanToolCallContent(content: string): string {
  let cleaned = content;
  let hadErrors = false;
  
  // Remove duplicate opening <function_call> tags
  // Pattern: <function_call>\s*<function_call> -> <function_call>
  const duplicateOpenings = cleaned.match(/<function_call>\s*<function_call>/g);
  if (duplicateOpenings) {
    console.log(`[ToolParser] 🔧 Fixed ${duplicateOpenings.length} duplicate opening tag(s)`);
    hadErrors = true;
    cleaned = cleaned.replace(
      /<function_call>\s*<function_call>/g,
      '<function_call>'
    );
  }
  
  // Remove duplicate closing </function_call> tags
  const duplicateClosings = cleaned.match(/<\/function_call>\s*<\/function_call>/g);
  if (duplicateClosings) {
    console.log(`[ToolParser] 🔧 Fixed ${duplicateClosings.length} duplicate closing tag(s)`);
    hadErrors = true;
    cleaned = cleaned.replace(
      /<\/function_call>\s*<\/function_call>/g,
      '</function_call>'
    );
  }
  
  // Fix cases where AI forgot to close previous tag and opened a new one
  // Pattern: <function_call>...(no closing tag)...<function_call> -> </function_call><function_call>
  // Look for: <function_call>...content...<function_call> where middle content has <tool_name>
  let unclosedFixed = 0;
  cleaned = cleaned.replace(
    /(<function_call>[\s\S]*?<tool_name>[\s\S]*?<\/tool_name>[\s\S]*?)(<function_call>)/g,
    (match, firstBlock, secondTag) => {
      // Check if firstBlock already has a closing tag
      if (firstBlock.includes('</function_call>')) {
        return match; // Already properly closed
      }
      // Add closing tag before opening new one
      unclosedFixed++;
      return firstBlock + '</function_call>\n' + secondTag;
    }
  );
  
  if (unclosedFixed > 0) {
    console.log(`[ToolParser] 🔧 Fixed ${unclosedFixed} unclosed tag(s) before new opening`);
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
  let match: RegExpExecArray | null;

  match = TOOL_BLOCK_REGEX_GLOBAL.exec(contentWithoutThinkBlocks);
  while (match !== null) {
    const innerContent = match[1];
    const parsed = parseToolBlockInternal(innerContent, match[0]);
    
    // Only process if this is a valid tool name
    if (parsed && VALID_TOOL_NAMES.has(parsed.toolName)) {
      toolBlocks.push(parsed);
    }
    
    match = TOOL_BLOCK_REGEX_GLOBAL.exec(contentWithoutThinkBlocks);
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
