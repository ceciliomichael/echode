import { memo, useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { LoadingDots } from '../loading-dots';
import { AssistantMessageItem } from './assistant-message-item';
import { LoadingIndicator } from './loading-indicator';
import { useVisibleTokens } from './use-visible-tokens';
import { areToolExecutionsEqual } from './utils';
import type { ToolExecutionState } from '../../../types/tool';
import type { ChatMode } from '../../../types/chat-mode';
import type { ApiSettings } from '../../../types/api-settings';
import { storageService } from '../../../utils/storage';

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

  const [showRawAssistantText, setShowRawAssistantText] = useState(() => {
    const settings = storageService.getSettings();
    return !!settings.miscellaneousSettings?.showRawAssistantText;
  });
  const [isRawExpanded, setIsRawExpanded] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ApiSettings | undefined;
      if (!detail) return;
      setShowRawAssistantText(!!detail.miscellaneousSettings?.showRawAssistantText);
    };

    window.addEventListener('settingsUpdated', handler);
    return () => window.removeEventListener('settingsUpdated', handler);
  }, []);

  const toggleRawExpanded = useCallback(() => {
    setIsRawExpanded((prev) => !prev);
  }, []);

  // Get tokenized and filtered content
  const { tokens, visibleTokens } = useVisibleTokens(content, messageId, toolExecutions);

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
      {showRawAssistantText && (
        <div
          style={{
            paddingLeft: '1.25rem',
            paddingRight: '1.25rem',
            maxWidth: contentMaxWidth,
            marginBottom: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={toggleRawExpanded}
            className="inline-flex items-center gap-1 text-sm hover:opacity-80"
            style={{ color: 'var(--vscode-descriptionForeground)', outline: 'none' }}
          >
            <span>Raw</span>
            {isRawExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
            ) : (
              <ChevronRight
                className="w-3.5 h-3.5"
                strokeWidth={1.5}
              />
            )}
          </button>

          {isRawExpanded && (
            <pre
              className="text-xs font-mono whitespace-pre-wrap break-words mt-1 p-2 rounded"
              style={{
                backgroundColor: 'var(--vscode-textCodeBlock-background)',
                color: 'var(--vscode-editor-foreground)',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {content}
            </pre>
          )}
        </div>
      )}
      <div
        className="max-w-none"
        style={{ color: 'var(--vscode-editor-foreground)' }}
      >
        {visibleTokens.map((token, index) => {
          const prevToken = index > 0 ? visibleTokens[index - 1] : null;

          return (
            <AssistantMessageItem
              key={`${token.type}-${messageId}-${token.index}`}
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