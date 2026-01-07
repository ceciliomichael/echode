import { memo } from 'react';
import type { ReactNode } from 'react';
import { LoadingDots } from '../loading-dots';
import { AssistantMessageItem } from './assistant-message-item';
import { LoadingIndicator } from './loading-indicator';
import { useVisibleTokens } from './use-visible-tokens';
import { areToolExecutionsEqual } from './utils';
import type { ToolExecutionState } from '../../../types/tool';
import type { ChatMode } from '../../../types/chat-mode';
import { ThinkBlock } from '../think-block';

export interface AssistantMessageProps {
  content: string;
  reasoningBlocks?: string[];
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
  reasoningBlocks,
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
  const hasReasoning = Boolean(reasoningBlocks?.some((b) => b.trim()));

  if (!content && !hasReasoning) {
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

  const renderReasoningBlock = (block: string, idx: number, marginTop: string, isStreamingBlock: boolean) => {
    if (!block.trim()) {
      return null;
    }

    return (
      <div
        key={`reasoning-${messageId}-${idx}`}
        style={{
          paddingLeft: '1.25rem',
          paddingRight: '1.25rem',
          maxWidth: contentMaxWidth,
          marginTop,
        }}
      >
        <ThinkBlock
          content={block}
          messageId={`${messageId}-reasoning-${idx}`}
          isStreaming={isStreamingBlock}
          isClosed={!isStreamingBlock}
        />
      </div>
    );
  };

  // Track if the last rendered item is an active ThinkBlock for LoadingIndicator
  let hasActiveThinkingAtBottom = false;

  const renderInterleavedContent = () => {
    const blocks = reasoningBlocks ?? [];
    let reasoningIndex = 0;

    const nodes: ReactNode[] = [];
    let lastNodeType: 'reasoning' | 'other' | null = null;
    let nodeCount = 0;

    const getMarginTop = () => {
      if (nodeCount === 0) return '0';
      // If previous was reasoning, use smaller gap for "normal new line spacing" feel
      if (lastNodeType === 'reasoning') return '0.25rem';
      return '0.75rem';
    };

    // Reasoning before any visible content (oldest)
    if (blocks.length > 0) {
      // It is streaming ONLY if it's the last block AND there are no visible tokens following it
      const isStreamingBlock = isStreaming && blocks.length === 1 && visibleTokens.length === 0;
      nodes.push(renderReasoningBlock(blocks[0], 0, '0', isStreamingBlock));
      reasoningIndex = 1;
      lastNodeType = 'reasoning';
      nodeCount++;
    }

    for (let i = 0; i < visibleTokens.length; i++) {
      const token = visibleTokens[i];
      nodes.push(
        <AssistantMessageItem
          key={`${token.type}-${messageId}-${token.index}`}
          token={token}
          index={nodeCount} // Legacy index prop, overridden by marginTop
          messageId={messageId}
          isStreaming={isStreaming}
          isLastMessage={isLastMessage}
          toolExecutions={toolExecutions}
          mode={mode}
          contentMaxWidth={contentMaxWidth}
          marginTop={getMarginTop()}
        />
      );
      lastNodeType = 'other';
      nodeCount++;

      // After each completed tool block, render the next reasoning phase
      if (token.type === 'tool' && token.isClosed && reasoningIndex < blocks.length) {
        // It is streaming if it's the last block AND we are at the last token (no more tokens follow)
        const isStreamingBlock = isStreaming && reasoningIndex === blocks.length - 1 && i === visibleTokens.length - 1;
        nodes.push(renderReasoningBlock(blocks[reasoningIndex], reasoningIndex, getMarginTop(), isStreamingBlock));
        reasoningIndex += 1;
        lastNodeType = 'reasoning';
        nodeCount++;
      }
    }

    // If there were no tools (or more reasoning blocks than tools), render remaining blocks at end
    while (reasoningIndex < blocks.length) {
      // These are definitely at the end of the visual flow
      const isStreamingBlock = isStreaming && reasoningIndex === blocks.length - 1;
      nodes.push(renderReasoningBlock(blocks[reasoningIndex], reasoningIndex, getMarginTop(), isStreamingBlock));
      reasoningIndex += 1;
      lastNodeType = 'reasoning';
      nodeCount++;
    }

    // Determine if active thinking is at the bottom (for suppressing loading dots)
    // This is true if we are streaming AND the last visual element was a streaming reasoning block
    if (isStreaming && lastNodeType === 'reasoning') {
      // Since our logic for isStreamingBlock above ensures only the last block streams, 
      // checking lastNodeType === 'reasoning' is sufficient, but we can be explicit:
      // If the last added node was a streaming reasoning block.
      // We know reasoningIndex has incremented past the last block.
      // So we check if the PREVIOUS block (length-1) was streaming.
      // Actually simpler: if logic resulted in a streaming block at the bottom.
      // Based on my logic: 
      // If lastNodeType is 'reasoning', then we just exited the 'while' loop or the 'blocks[0]' block or the 'loop if' block.
      // In all those cases, we set isStreamingBlock correctly. 
      // So if the last block rendered was indeed set to streaming, then activeThinkingAtBottom is true.

      // Basically, if we rendered the last block, did we set it to streaming?
      // Yes, if isStreaming is true.
      hasActiveThinkingAtBottom = true;
    }

    return nodes;
  };

  return (
    <div>
      <div
        className="max-w-none"
        style={{ color: 'var(--vscode-editor-foreground)' }}
      >
        {renderInterleavedContent()}

        {/* Show loading dots when waiting for response after tool or think block */}
        <LoadingIndicator
          isStreaming={isStreaming}
          tokens={tokens}
          visibleTokens={visibleTokens}
          toolExecutions={toolExecutions}
          hasActiveThinkingAtBottom={hasActiveThinkingAtBottom}
          isLastMessage={isLastMessage}
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

  const reasoningBlocksEqual =
    prev.reasoningBlocks === next.reasoningBlocks ||
    (!prev.reasoningBlocks && !next.reasoningBlocks);

  return (
    prev.content === next.content &&
    prev.messageId === next.messageId &&
    prev.isStreaming === next.isStreaming &&
    prev.mode === next.mode &&
    toolExecutionsEqual &&
    reasoningBlocksEqual
  );
});