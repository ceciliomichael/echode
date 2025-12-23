import { memo } from 'react';
import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMode } from '../../types/chat-mode';
import type { Provider } from '../../types/api-settings';
import type { ContextUsageResult } from '../../hooks/use-context-usage';

import { UserMessage } from './user-message';
import { AssistantMessage } from './assistant-message';

interface MessageBubbleProps {
  message: Message;
  onEdit?: (messageId: string, newContent: string, imageAttachments?: ImageAttachment[], forceEchoSearch?: boolean) => void;
  onUpdate?: (messageId: string, newContent: string) => void;
  isEditing?: boolean;
  onEditStart?: (messageId: string) => void;
  onEditCancel?: () => void;
  onRevert?: (messageId: string) => void;
  isStreaming?: boolean;
  isLastMessage?: boolean;
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  contextUsage?: ContextUsageResult;
}

function MessageBubbleComponent({ message, onEdit, onUpdate, isEditing, onEditStart, onEditCancel, onRevert, isStreaming, isLastMessage, mode, onModeChange, provider, model, onModelChange, contextUsage }: MessageBubbleProps) {

  if (message.role === 'user') {
    return (
      <UserMessage
        content={message.content}
        messageId={message.id}
        onEdit={onEdit || (() => { })}
        onUpdate={onUpdate || (() => { })}
        isEditing={isEditing || false}
        onEditStart={onEditStart || (() => { })}
        onEditCancel={onEditCancel || (() => { })}
        onRevert={onRevert}
        imageAttachments={message.attachments}
        mode={mode}
        onModeChange={onModeChange}
        provider={provider}
        model={model}
        onModelChange={onModelChange}
        contextUsage={contextUsage}
      />
    );
  }

  return (
    <div className="flex w-full">
      <div className="w-full">
        <AssistantMessage
          content={message.content}
          messageId={message.id}
          isStreaming={isStreaming}
          isLastMessage={isLastMessage}
          toolExecutions={message.toolExecutions}
          mode={message.mode}
        />
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleComponent, (prev, next) => {
  // 1. Check critical UI flags
  if (
    prev.isEditing !== next.isEditing ||
    prev.isStreaming !== next.isStreaming ||
    prev.isLastMessage !== next.isLastMessage ||
    prev.mode !== next.mode
  ) {
    return false;
  }

  // 2. Check message identity and content
  if (
    prev.message.id !== next.message.id ||
    prev.message.content !== next.message.content ||
    prev.message.role !== next.message.role ||
    prev.message.mode !== next.message.mode
  ) {
    return false;
  }

  // 3. Check tool executions (reference equality is usually sufficient for immutable state)
  if (prev.message.toolExecutions !== next.message.toolExecutions) {
    return false;
  }

  // 4. Role-specific checks
  if (prev.message.role === 'user') {
    // User messages use these extra props
    if (
      prev.provider !== next.provider ||
      prev.model !== next.model ||
      prev.contextUsage !== next.contextUsage ||
      prev.message.attachments !== next.message.attachments
    ) {
      return false;
    }
  }

  // For assistant messages, we can IGNORE contextUsage, provider, model, and handlers
  // as they are not used in the render output of AssistantMessage.
  // This prevents all assistant messages from re-rendering when token counts update.

  return true;
});
