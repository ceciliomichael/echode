/**
 * Utility for parsing <think> and <thinking> blocks from AI responses
 */

export interface ParsedContent {
  thinkBlocks: Array<{ content: string; index: number }>;
  textContent: string;
}

/**
 * Remove all <think> and <thinking> blocks from content
 * Used to exclude thinking content from chat history
 */
export function removeThinkBlocks(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
    .replace(/<reasoning_content>[\s\S]*?<\/reasoning_content>/g, '')
    .replace(/<think>[\s\S]*$/g, '') // Remove unclosed <think> at end
    .replace(/<thinking>[\s\S]*$/g, '') // Remove unclosed <thinking> at end
    .replace(/<reasoning_content>[\s\S]*$/g, ''); // Remove unclosed <reasoning_content> at end
}

/**
 * Parse content to extract <think> and <thinking> blocks (including unclosed ones during streaming)
 */
export function parseThinkBlocks(content: string): ParsedContent {
  const thinkBlocks: Array<{ content: string; index: number }> = [];
  let textContent = '';

  // Process both <think> and <thinking> tags
  const tagPatterns = [
    { open: '<think>', close: '</think>', openLen: 7, closeLen: 8 },
    { open: '<thinking>', close: '</thinking>', openLen: 10, closeLen: 11 },
    { open: '<reasoning_content>', close: '</reasoning_content>', openLen: 19, closeLen: 20 }
  ];

  // Find all think/thinking blocks in order
  const blocks: Array<{ start: number; end: number; content: string; tagType: string }> = [];

  for (const pattern of tagPatterns) {
    let searchPos = 0;
    while (true) {
      const openIndex = content.indexOf(pattern.open, searchPos);
      if (openIndex === -1) { break; }

      const contentStart = openIndex + pattern.openLen;
      const closeIndex = content.indexOf(pattern.close, contentStart);

      if (closeIndex !== -1) {
        // Closed block
        blocks.push({
          start: openIndex,
          end: closeIndex + pattern.closeLen,
          content: content.slice(contentStart, closeIndex),
          tagType: pattern.open
        });
        searchPos = closeIndex + pattern.closeLen;
      } else {
        // Unclosed block (streaming)
        blocks.push({
          start: openIndex,
          end: content.length,
          content: content.slice(contentStart),
          tagType: pattern.open
        });
        break;
      }
    }
  }

  // Sort blocks by start position
  blocks.sort((a, b) => a.start - b.start);

  // Build textContent with placeholders
  let lastIndex = 0;
  for (const block of blocks) {
    textContent += content.slice(lastIndex, block.start);
    thinkBlocks.push({
      content: block.content,
      index: thinkBlocks.length
    });
    textContent += `__THINK_BLOCK_${thinkBlocks.length - 1}__`;
    lastIndex = block.end;
  }

  // Add remaining text
  textContent += content.slice(lastIndex);

  return { thinkBlocks, textContent };
}
