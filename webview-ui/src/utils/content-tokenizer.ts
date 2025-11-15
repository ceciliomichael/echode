/**
 * Content tokenization for stable rendering during streaming
 */

export type ContentToken =
  | { type: 'think'; content: string; index: number; isClosed: boolean }
  | { type: 'text'; content: string; index: number };

/**
 * Tokenize content into stable segments (think blocks and text)
 */
export function tokenizeContent(content: string): ContentToken[] {
  const tokens: ContentToken[] = [];
  let lastIndex = 0;
  let tokenIndex = 0;

  // Find all <think> opening tags
  const openTagRegex = /<think>/g;
  let match;

  while ((match = openTagRegex.exec(content)) !== null) {
    const openIndex = match.index;
    const contentStart = openIndex + 7; // length of '<think>'
    
    // Add text before this think block
    const textBefore = content.slice(lastIndex, openIndex);
    if (textBefore) {
      tokens.push({
        type: 'text',
        content: textBefore,
        index: tokenIndex++
      });
    }
    
    // Look for closing tag
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
      lastIndex = closeTag + 8; // length of '</think>'
    } else {
      // Unclosed think block (streaming)
      const thinkContent = content.slice(contentStart);
      tokens.push({
        type: 'think',
        content: thinkContent,
        index: tokenIndex++,
        isClosed: false
      });
      lastIndex = content.length;
      break;
    }
  }
  
  // Add remaining text
  const remainingText = content.slice(lastIndex);
  if (remainingText) {
    tokens.push({
      type: 'text',
      content: remainingText,
      index: tokenIndex++
    });
  }
  
  return tokens;
}
