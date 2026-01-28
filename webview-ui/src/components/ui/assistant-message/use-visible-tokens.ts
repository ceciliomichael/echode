import { useMemo } from 'react';
import { tokenizeContent } from '../../../utils/content-tokenizer';
import type { ToolExecutionState } from '../../../types/tool';

/**
 * Custom hook that tokenizes content and filters out non-visible tokens.
 * Handles empty text, incomplete think blocks, and file modification tools without paths.
 */
export function useVisibleTokens(
  content: string,
  messageId: string,
  toolExecutions?: Map<string, ToolExecutionState>
) {

  // Tokenize content into stable segments
  const tokens = useMemo(
    () => tokenizeContent(content, messageId),
    [content, messageId]
  );

  // Filter out empty text tokens, empty think blocks, and incomplete tool blocks
  const visibleTokens = useMemo(() => {
    return tokens.filter((token) => {

      // Filter empty text
      if (token.type === 'text' && token.content.trim() === '') {
        return false;
      }
      // Hide think/thinking blocks until they have actual content
      if (token.type === 'think' && token.content.trim() === '') {
        return false;
      }
      // For tool blocks, show as soon as tool name is known (to display loading state)
      if (token.type === 'tool') {

        // Must have a valid tool name to display
        if (!token.toolName || token.toolName.trim() === '') {
          return false;
        }
        // For file modification tools, also require path parameter
        const isFileModificationTool =
          token.toolName === 'write_to_file' || token.toolName === 'edit';
        if (isFileModificationTool) {
          const tokenPath = token.toolName === 'edit'
            ? (token.parameters.file_path as string | undefined)
            : (token.parameters.path as string | undefined);
          const executionPath = token.toolName === 'edit'
            ? (toolExecutions?.get(token.toolExecutionId)?.parameters?.file_path as string | undefined)
            : (toolExecutions?.get(token.toolExecutionId)?.parameters?.path as string | undefined);
          const path = tokenPath || executionPath;
          // Show if path is present and not empty
          if (path && path.trim() !== '') {
            return true;
          }

          // Hide if path is missing or empty
          return false;
        }

        // For all other tools, show immediately once tool name is known
        // This allows displaying loading states like "Planning", "Searching", etc.
        return true;
      }
      return true;
    });
  }, [tokens, toolExecutions]);

  return { tokens, visibleTokens };
}