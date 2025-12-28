import { memo } from 'react';
import { LoadingDots } from '../loading-dots';
import { AssistantMessageItem } from './assistant-message-item';
import { LoadingIndicator } from './loading-indicator';
import { useVisibleTokens } from './use-visible-tokens';
import { areToolExecutionsEqual } from './utils';
import type { ToolExecutionState } from '../../../types/tool';
import type { ChatMode } from '../../../types/chat-mode';

export interface AssistantMessageProps {
  content: string;
  messageId?: string;
  isStreaming?: boolean;
  isLastMessage?: boolean;
  toolExecutions?: Map<string, ToolExecutionState>;
  mode?: ChatMode;
}

/**
 * Internal component that renders the assistant message content.
 * Handles tokenization, filtering, and rendering of different content types.
 */
function AssistantMessageView({
  content,
  messageId = 'unknown',
  isStreaming = false,
  isLastMessage = true,
  toolExecutions,
  mode,
}: AssistantMessageProps) {
  // Allow text/think to span wider while staying slightly inset
  const contentMaxWidth = 'min(110ch, 100%)';

  // Get tokenized and filtered content
  const { tokens, visibleTokens } = useVisibleTokens(content, messageId);

  // Handle empty content with streaming state
  if (!content) {
    // Show loading dots when message is empty and pipeline is active
    // This includes: AI streaming OR tool executing (waiting for AI response)
    if (isStreaming) {
      return (
        <div style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
          <div className="max-w-none">
            <LoadingDots label="Thinking" />
          </div>
        </div>
      );
    }
    // Don't render anything if no content and pipeline stopped
    return null;
  }

  return (
    <div>
      <div
        className="max-w-none"
        style={{ color: 'var(--vscode-editor-foreground)' }}
      >
        {visibleTokens.map((token, index) => {
          const prevToken = index > 0 ? visibleTokens[index - 1] : null;

          return (
            <AssistantMessageItem
              key={token.type === 'think'
                ? `think-${messageId}-${token.content.slice(0, 50).replace(/\s/g, '')}`
                : `${token.type}-${messageId}-${token.index}`}
              token={token}
              prevToken={prevToken}
              index={index}
              messageId={messageId}
              isStreaming={isStreaming}
              isLastMessage={isLastMessage}
              toolExecutions={toolExecutions}
              mode={mode}
              contentMaxWidth={contentMaxWidth}
            />
          );
        })}

        {/* Show loading dots when waiting for response after tool or think block */}
        <LoadingIndicator
          isStreaming={isStreaming}
          tokens={tokens}
          visibleTokens={visibleTokens}
          toolExecutions={toolExecutions}
        />
      </div>
    </div>
  );
}

/**
 * Memoized assistant message component.
 * Uses custom comparison to prevent unnecessary re-renders from toolExecutions map.
 */
export const AssistantMessage = memo(AssistantMessageView, (prev, next) => {
  const toolExecutionsEqual = areToolExecutionsEqual(
    prev.toolExecutions,
    next.toolExecutions
  );

  return (
    prev.content === next.content &&
    prev.messageId === next.messageId &&
    prev.isStreaming === next.isStreaming &&
    prev.mode === next.mode &&
    toolExecutionsEqual
  );
});