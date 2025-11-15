/**
 * Utility for parsing <think> blocks from AI responses
 */

export interface ParsedContent {
  thinkBlocks: Array<{ content: string; index: number }>;
  textContent: string;
}

/**
 * Parse content to extract <think> blocks (including unclosed ones during streaming)
 */
export function parseThinkBlocks(content: string): ParsedContent {
  const thinkBlocks: Array<{ content: string; index: number }> = [];
  let textContent = '';
  let lastIndex = 0;

  // Find all <think> opening tags
  const openTagRegex = /<think>/g;
  let match;

  while ((match = openTagRegex.exec(content)) !== null) {
    const openIndex = match.index;
    const contentStart = openIndex + 7; // length of '<think>'
    
    // Look for closing tag
    const closeTag = content.indexOf('</think>', contentStart);
    
    // Add text before this think block
    textContent += content.slice(lastIndex, openIndex);
    
    if (closeTag !== -1) {
      // Closed think block
      const thinkContent = content.slice(contentStart, closeTag);
      thinkBlocks.push({
        content: thinkContent,
        index: thinkBlocks.length
      });
      textContent += `__THINK_BLOCK_${thinkBlocks.length - 1}__`;
      lastIndex = closeTag + 8; // length of '</think>'
    } else {
      // Unclosed think block (streaming)
      const thinkContent = content.slice(contentStart);
      thinkBlocks.push({
        content: thinkContent,
        index: thinkBlocks.length
      });
      textContent += `__THINK_BLOCK_${thinkBlocks.length - 1}__`;
      lastIndex = content.length;
      break;
    }
  }
  
  // Add remaining text
  textContent += content.slice(lastIndex);
  
  return { thinkBlocks, textContent };
}
