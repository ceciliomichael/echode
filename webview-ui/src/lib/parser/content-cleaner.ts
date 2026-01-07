/**
 * Content cleaning utilities for fixing AI formatting mistakes
 * Single Responsibility: Clean and normalize tool call XML content
 */

/**
 * Clean up common AI mistakes in tool call formatting
 * Handles cases like duplicate opening tags, unclosed tags, malformed closing tags
 */
export function cleanToolCallContent(content: string): string {
  let cleaned = content;
  let hadErrors = false;

  // Fix corrupted tool call formats (AI hallucinations)
  // Pattern: <tool_call>function_calls> or similar hybrid formats
  const corruptedPatterns = [
    // <tool_call>function_calls> -> <function_calls>
    { pattern: /<tool_call>function_calls>/gi, replacement: '<function_calls>' },
    // <tool_call> -> <function_calls>
    { pattern: /<tool_call>/gi, replacement: '<function_calls>' },
    // </tool_call> -> </function_calls>
    { pattern: /<\/tool_call>/gi, replacement: '</function_calls>' },
    // <tool_code> -> <function_calls>
    { pattern: /<tool_code>/gi, replacement: '<function_calls>' },
    // </tool_code> -> </function_calls>
    { pattern: /<\/tool_code>/gi, replacement: '</function_calls>' },
    // <|tool|> or <|tool_call|> -> <function_calls>
    { pattern: /<\|tool\|>/gi, replacement: '<function_calls>' },
    { pattern: /<\|tool_call\|>/gi, replacement: '<function_calls>' },
    { pattern: /<\|\/tool\|>/gi, replacement: '</function_calls>' },
    { pattern: /<\|\/tool_call\|>/gi, replacement: '</function_calls>' },
  ];

  for (const { pattern, replacement } of corruptedPatterns) {
    if (pattern.test(cleaned)) {
      hadErrors = true;
      cleaned = cleaned.replace(pattern, replacement);
    }
  }

  // Remove duplicate opening <function_calls> tags
  const duplicateOpenings = cleaned.match(/<function_calls>\s*<function_calls>/g);
  if (duplicateOpenings) {
    hadErrors = true;
    cleaned = cleaned.replace(/<function_calls>\s*<function_calls>/g, '<function_calls>');
  }

  // Remove duplicate closing </function_calls> tags
  const duplicateClosings = cleaned.match(/<\/function_calls>\s*<\/function_calls>/g);
  if (duplicateClosings) {
    hadErrors = true;
    cleaned = cleaned.replace(/<\/function_calls>\s*<\/function_calls>/g, '</function_calls>');
  }

  // Fix cases where AI forgot to close previous tag and opened a new one
  let unclosedFixed = 0;
  cleaned = cleaned.replace(
    /(<function_calls>[\s\S]*?<invoke[\s\S]*?<\/invoke>[\s\S]*?)(<function_calls>)/g,
    (match, firstBlock, secondTag) => {
      if (firstBlock.includes('</function_calls>')) {
        return match;
      }
      unclosedFixed++;
      return firstBlock + '</function_calls>\n' + secondTag;
    }
  );

  if (unclosedFixed > 0) {
    hadErrors = true;
  }

  // Fix malformed closing tags with backslashes: <\param> -> </param>
  const backslashClosings = cleaned.match(/<\\[\w_-]+>/g);
  if (backslashClosings) {
    hadErrors = true;
    cleaned = cleaned.replace(/<\\([\w_-]+)>/g, '</$1>');
  }

  // Fix malformed invoke tags
  const malformedInvokes = cleaned.match(/<invoke\s+name=["'][^"']+["']\s*[^>]*(?!>)/g);
  if (malformedInvokes) {
    hadErrors = true;
    // Handle malformed invoke tags
    cleaned = cleaned.replace(/<invoke\s+name=["'][^"']+["']\s*[^>]*(?!>)/g, '');
  }

  if (hadErrors) {
    // Handle errors if needed in the future
  }

  return cleaned;
}

/**
 * Remove markdown code blocks from content OUTSIDE of function_calls blocks.
 * Content INSIDE function_calls (including ```) is preserved as-is.
 */
export function removeCodeBlocks(content: string): string {
  let result = '';
  let i = 0;
  let inFence = false;
  let inFunctionCalls = false;

  const openTag = '<function_calls>';
  const closeTag = '</function_calls>';

  while (i < content.length) {
    // Check for function_calls tags
    if (content.startsWith(openTag, i)) {
      inFunctionCalls = true;
      result += openTag;
      i += openTag.length;
      continue;
    }

    if (content.startsWith(closeTag, i)) {
      inFunctionCalls = false;
      result += closeTag;
      i += closeTag.length;
      continue;
    }

    // Inside function_calls: preserve EVERYTHING including ```
    if (inFunctionCalls) {
      result += content[i];
      i++;
      continue;
    }

    // Outside function_calls: handle code block fencing
    if (content.startsWith('```', i)) {
      inFence = !inFence;
      i += 3;
      // Skip language identifier on opening fence
      if (inFence) {
        while (i < content.length && content[i] !== '\n' && content[i] !== '\r') {
          i++;
        }
      }
      continue;
    }

    // Outside function_calls and outside fence: add to result
    if (!inFence) {
      result += content[i];
    }

    i++;
  }

  return result;
}

/**
 * Preprocess content for tool parsing
 * Combines code block removal, think block removal, and content cleaning
 */
export function preprocessContent(content: string): string {
  const withoutCodeBlocks = removeCodeBlocks(content);
  return cleanToolCallContent(withoutCodeBlocks);
}
