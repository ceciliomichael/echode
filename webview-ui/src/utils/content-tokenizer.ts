/**
 * Content tokenization for stable rendering during streaming
 */

export type ContentToken =
  | { type: 'think'; content: string; index: number; isClosed: boolean }
  | { type: 'tool'; toolName: string; parameters: Record<string, unknown>; rawContent: string; index: number; isClosed: boolean; toolExecutionId: string }
  | { type: 'text'; content: string; index: number };

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
    // Check for think block and tool block
    const thinkStart = content.indexOf('<think>', position);
    const toolStart = content.indexOf('```tool:', position);
    
    // Determine which comes first
    let nextBlockStart = -1;
    let blockType: 'think' | 'tool' | null = null;
    
    if (thinkStart !== -1 && (toolStart === -1 || thinkStart < toolStart)) {
      nextBlockStart = thinkStart;
      blockType = 'think';
    } else if (toolStart !== -1) {
      nextBlockStart = toolStart;
      blockType = 'tool';
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
    // Process tool block
    else if (blockType === 'tool') {
      // Match pattern: ```tool:TOOL_NAME\n{json}\n```
      const toolNameMatch = content.slice(toolStart).match(/^```tool:([\w:.-]+)\s*\n/);
      if (!toolNameMatch) {
        // Invalid tool block format, treat as text
        position = toolStart + 1;
        continue;
      }
      
      const toolName = toolNameMatch[1];
      const paramStart = toolStart + toolNameMatch[0].length;
      const closeMarker = content.indexOf('\n```', paramStart);
      
      if (closeMarker !== -1) {
        // Closed tool block
        const paramString = content.slice(paramStart, closeMarker);
        try {
          const parameters = paramString.trim() ? JSON.parse(paramString.trim()) : {};
          const rawContent = content.slice(toolStart, closeMarker + 4); // Include closing ```
          tokens.push({
            type: 'tool',
            toolName,
            parameters,
            rawContent,
            index: tokenIndex++,
            isClosed: true,
            toolExecutionId: `${messageId}-tool-${toolIndex++}`
          });
          position = closeMarker + 4; // Skip past closing ```
        } catch {
          // Invalid JSON, treat as text
          tokens.push({
            type: 'text',
            content: content.slice(toolStart, paramStart),
            index: tokenIndex++
          });
          position = paramStart;
        }
      } else {
        // Unclosed tool block (streaming)
        const paramString = content.slice(paramStart);
        try {
          const parameters = paramString.trim() ? JSON.parse(paramString.trim()) : {};
          const rawContent = content.slice(toolStart);
          tokens.push({
            type: 'tool',
            toolName,
            parameters,
            rawContent,
            index: tokenIndex++,
            isClosed: false,
            toolExecutionId: `${messageId}-tool-${toolIndex++}`
          });
        } catch {
          // Invalid JSON but still streaming, include as partial tool block
          tokens.push({
            type: 'tool',
            toolName,
            parameters: {},
            rawContent: content.slice(toolStart),
            index: tokenIndex++,
            isClosed: false,
            toolExecutionId: `${messageId}-tool-${toolIndex++}`
          });
        }
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
