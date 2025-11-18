import type { Message } from '../../types/chat';
import { UserMessage } from './user-message';
import { AssistantMessage } from './assistant-message';

interface MessageBubbleProps {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
  onUpdate?: (messageId: string, newContent: string) => void;
  isEditing?: boolean;
  onEditStart?: (messageId: string) => void;
  onEditCancel?: () => void;
  isStreaming?: boolean;
}

export function MessageBubble({ message, onEdit, onUpdate, isEditing, onEditStart, onEditCancel, isStreaming, showCopy }: MessageBubbleProps & { showCopy?: boolean }) {
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
      />
    );
  }

  return (
    <AssistantMessage 
      content={message.content} 
      messageId={message.id}
      isStreaming={isStreaming}
      showCopy={showCopy}
      toolExecutions={message.toolExecutions}
    />
  );
}