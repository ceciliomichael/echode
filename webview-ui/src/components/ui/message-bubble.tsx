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

export const MessageBubble = memo(MessageBubbleComponent);
