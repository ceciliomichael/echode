import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMode } from '../../types/chat-mode';
import type { Provider } from '../../types/api-settings';

import { UserMessage } from './user-message';
import { AssistantMessage } from './assistant-message';

interface MessageBubbleProps {
  message: Message;
  onEdit?: (messageId: string, newContent: string, attachments?: ImageAttachment[]) => void;
  onUpdate?: (messageId: string, newContent: string) => void;
  isEditing?: boolean;
  onEditStart?: (messageId: string) => void;
  onEditCancel?: () => void;
  onRevert?: (messageId: string) => void;
  isStreaming?: boolean;
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
}

export function MessageBubble({ message, onEdit, onUpdate, isEditing, onEditStart, onEditCancel, onRevert, isStreaming, mode, onModeChange, provider, model, onModelChange }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <UserMessage
        content={message.content}
        messageId={message.id}
        onEdit={onEdit || (() => {})}
        onUpdate={onUpdate || (() => {})}
        isEditing={isEditing || false}
        onEditStart={onEditStart || (() => {})}
        onEditCancel={onEditCancel || (() => {})}
        onRevert={onRevert}
        attachments={message.attachments}
        mode={mode}
        onModeChange={onModeChange}
        provider={provider}
        model={model}
        onModelChange={onModelChange}
      />
    );
  }

  return (
    <AssistantMessage 
      content={message.content} 
      messageId={message.id}
      isStreaming={isStreaming}
      toolExecutions={message.toolExecutions}
    />
  );
}