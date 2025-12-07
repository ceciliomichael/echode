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

  // Remove duplicate opening <function_calls> tags
  const duplicateOpenings = cleaned.match(/<function_calls>\s*<function_calls>/g);
  if (duplicateOpenings) {
    console.log(`[ContentCleaner] Fixed ${duplicateOpenings.length} duplicate opening tag(s)`);
    hadErrors = true;
    cleaned = cleaned.replace(/<function_calls>\s*<function_calls>/g, '<function_calls>');
  }

  // Remove duplicate closing </function_calls> tags
  const duplicateClosings = cleaned.match(/<\/function_calls>\s*<\/function_calls>/g);
  if (duplicateClosings) {
    console.log(`[ContentCleaner] Fixed ${duplicateClosings.length} duplicate closing tag(s)`);
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
    console.log(`[ContentCleaner] Fixed ${unclosedFixed} unclosed tag(s) before new opening`);
    hadErrors = true;
  }

  // Fix malformed closing tags with backslashes: <\param> -> </param>
  const backslashClosings = cleaned.match(/<\\[\w_-]+>/g);
  if (backslashClosings) {
    console.log(
      `[ContentCleaner] Fixed ${backslashClosings.length} backslash closing tag(s)`
    );
    hadErrors = true;
    cleaned = cleaned.replace(/<\\([\w_-]+)>/g, '</$1>');
  }

  // Fix malformed invoke tags
  const malformedInvokes = cleaned.match(/<invoke\s+name=["'][^"']+["']\s*[^>]*(?!>)/g);
  if (malformedInvokes) {
    console.log(`[ContentCleaner] Fixed ${malformedInvokes.length} malformed invoke tag(s)`);
    hadErrors = true;
  }

  if (hadErrors) {
    console.log('[ContentCleaner] AI generated malformed XML - automatically corrected');
  }

  return cleaned;
}

/**
 * Remove think/thinking blocks from content
 * These blocks contain AI reasoning that should not be parsed as tool calls
 * 
 * Handles both:
 * 1. Complete blocks: <think>...</think>
 * 2. Incomplete/streaming blocks: <think>... (no closing tag yet)
 */
export function removeThinkBlocks(content: string): string {
  let result = content;
  
  // First, remove complete think blocks
  result = result
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
  
  // Then, remove incomplete/unclosed think blocks (streaming case)
  // If <think> exists without a closing </think>, remove from <think> to end
  const unclosedThinkMatch = result.match(/<think>(?![\s\S]*<\/think>)/);
  if (unclosedThinkMatch && unclosedThinkMatch.index !== undefined) {
    result = result.slice(0, unclosedThinkMatch.index);
  }
  
  const unclosedThinkingMatch = result.match(/<thinking>(?![\s\S]*<\/thinking>)/);
  if (unclosedThinkingMatch && unclosedThinkingMatch.index !== undefined) {
    result = result.slice(0, unclosedThinkingMatch.index);
  }
  
  return result;
}

/**
 * Preprocess content for tool parsing
 * Combines think block removal and content cleaning
 */
export function preprocessContent(content: string): string {
  const withoutThink = removeThinkBlocks(content);
  return cleanToolCallContent(withoutThink);
}
