import { ThinkBlock } from '../think-block';
import { ToolBlock } from '../tool-block';
import { MermaidBlock } from '../mermaid-block';
import { StreamingText } from '../streaming-text';
import { sanitizeAssistantText } from './utils';
import type { ToolCall, ToolExecutionState } from '../../../types/tool';
import type { ChatMode } from '../../../types/chat-mode';
import type { ContentToken } from '../../../utils/content-tokenizer';

interface AssistantMessageItemProps {
  token: ContentToken;
  prevToken: ContentToken | null;
  index: number;
  messageId: string;
  isStreaming: boolean;
  isLastMessage: boolean;
  toolExecutions?: Map<string, ToolExecutionState>;
  mode?: ChatMode;
  contentMaxWidth: string;
}

/**
 * Renders a single content token (Think, Tool, Text, or Mermaid block).
 * Handles margin spacing based on previous token type.
 */
export function AssistantMessageItem({
  token,
  prevToken,
  index,
  messageId,
  isStreaming,
  isLastMessage,
  toolExecutions,
  mode,
  contentMaxWidth,
}: AssistantMessageItemProps) {
  // Margin logic: consistent spacing for all content types
  const marginTop = index === 0 ? '0' : '0.75rem';

  // Think block
  if (token.type === 'think') {
    return (
      <div
        key={`think-${messageId}-${token.index}`}
        style={{
          marginTop,
          paddingLeft: '1.25rem',
          paddingRight: '1.25rem',
          maxWidth: contentMaxWidth,
        }}
      >
        <ThinkBlock
          content={token.content}
          messageId={`${messageId}-${token.index}`}
          isStreaming={isStreaming && !token.isClosed}
          isClosed={token.isClosed}
        />
      </div>
    );
  }

  // Tool block
  if (token.type === 'tool') {
    // Merge token data with execution state if available
    const executionState = toolExecutions?.get(token.toolExecutionId);

    // Special handling: Split multi-file read_file results into separate tool blocks
    if (
      token.toolName === 'read_file' &&
      executionState?.result?.success &&
      executionState.result.data
    ) {
      const resultData = executionState.result.data as Record<string, unknown>;

      // Check if this is a multi-file result
      if (
        'files' in resultData &&
        Array.isArray(resultData.files) &&
        resultData.files.length > 1
      ) {
        const files = resultData.files as Array<{
          path: string;
          content: string;
          startLine?: number;
          endLine?: number;
          totalLines?: number;
        }>;

        // Render each file as a separate tool block
        return (
          <>
            {files.map((file, fileIdx) => {
              const fileToolExecutionId = `${token.toolExecutionId}-file-${fileIdx}`;
              const fileExecutionState = toolExecutions?.get(fileToolExecutionId);

              const fileToolCall: ToolCall = {
                toolName: token.toolName,
                parameters: { path: file.path, ...token.parameters },
                status: fileExecutionState?.status || 'completed',
                result: fileExecutionState?.result || {
                  success: true,
                  data: file,
                },
                toolExecutionId: fileToolExecutionId,
              };

              return (
                <div key={`tool-${messageId}-${token.index}-file-${fileIdx}`}>
                  <ToolBlock
                    toolCall={fileToolCall}
                    isStreaming={false}
                    messageId={messageId}
                    isLastMessage={isLastMessage}
                    mode={mode}
                  />
                </div>
              );
            })}
          </>
        );
      }
    }

    // Normal tool rendering (single file or other tools)
    // Determine status: if no executionState and tool isn't closed and not streaming = aborted
    const derivedStatus =
      executionState?.status ||
      (token.isClosed ? 'completed' : isStreaming ? 'pending' : 'aborted');

    const toolCall: ToolCall = {
      toolName: token.toolName,
      // Prioritize execution parameters as they are authoritative during execution
      parameters: executionState?.parameters || token.parameters,
      status: derivedStatus,
      result: executionState?.result,
      toolExecutionId: token.toolExecutionId,
      progress: executionState?.progress,
    };

    return (
      <div key={`tool-${messageId}-${token.index}`}>
        <ToolBlock
          toolCall={toolCall}
          isStreaming={isStreaming && !token.isClosed}
          messageId={messageId}
          isLastMessage={isLastMessage}
          mode={mode}
        />
      </div>
    );
  }

  // Text content with animated streaming markdown
  if (token.type === 'text') {
    // visibleTokens already filtered out empty text, but double check just in case
    if (!token.content.trim()) return null;

    // Reduce spacing when text follows a think block for tighter visual flow
    const textMarginTop = prevToken?.type === 'think' ? '0.1rem' : marginTop;

    const sanitizedContent = sanitizeAssistantText(token.content);

    return (
      <div
        key={`text-${messageId}-${token.index}`}
        style={{
          marginTop: textMarginTop,
          paddingLeft: '1.25rem',
          paddingRight: '1.25rem',
          maxWidth: contentMaxWidth,
        }}
      >
        <StreamingText content={sanitizedContent} isStreaming={isStreaming} />
      </div>
    );
  }

  // Mermaid diagram - render as separate stable block
  if (token.type === 'mermaid') {
    return (
      <div
        key={`mermaid-${messageId}-${token.index}`}
        style={{ marginTop, paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
      >
        <MermaidBlock code={token.content} isGenerating={!token.isClosed} />
      </div>
    );
  }

  return null;
}