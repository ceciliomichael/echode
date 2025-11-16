/**
 * Content tokenization for stable rendering during streaming
 */

export type ContentToken =
  | { type: 'think'; content: string; index: number; isClosed: boolean }
  | { type: 'text'; content: string; index: number };

/**
 * Tokenize content into stable segments (think blocks and text)
 * Process sequentially to avoid parsing content inside think blocks
 */
export function tokenizeContent(content: string): ContentToken[] {
  const tokens: ContentToken[] = [];
  let position = 0;
  let tokenIndex = 0;

  while (position < content.length) {
    // Check for think block
    const thinkStart = content.indexOf('<think>', position);
    
    // Add text before next block
    if (thinkStart !== -1 && thinkStart > position) {
      const textContent = content.slice(position, thinkStart);
      if (textContent) {
        tokens.push({
          type: 'text',
          content: textContent,
          index: tokenIndex++
        });
      }
      position = thinkStart;
    }
    
    // Process think block
    if (thinkStart !== -1) {
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
    // No more blocks
    else {
      const remainingText = content.slice(position);
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
