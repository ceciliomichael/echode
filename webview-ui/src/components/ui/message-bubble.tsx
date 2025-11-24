import type { Message, ImageAttachment } from '../../types/chat';
import type { ChatMode } from '../../types/chat-mode';
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
}

export function MessageBubble({ message, onEdit, onUpdate, isEditing, onEditStart, onEditCancel, onRevert, isStreaming, mode, onModeChange }: MessageBubbleProps) {
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