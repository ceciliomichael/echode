import { useState } from 'react';
import { MessageBubble } from '../ui/message-bubble';
import { ChatInput } from '../ui/chat-input';
import { ChatEmptyState } from '../ui/chat-empty-state';
import { useStreamingChat } from '../../hooks/use-streaming-chat';

export function ChatContainer() {
  const { messages, isStreaming, sendMessage, editMessage, updateMessage } = useStreamingChat();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  const handleEditStart = (messageId: string) => {
    setEditingMessageId(messageId);
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    setEditingMessageId(null);
    await editMessage(messageId, newContent);
  };

  const handleUpdate = (messageId: string, newContent: string) => {
    updateMessage(messageId, newContent);
    setEditingMessageId(null);
  };

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--vscode-sideBar-background)' }}>
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {messages.length === 0 ? (
          <ChatEmptyState />
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onEdit={handleEdit}
                onUpdate={handleUpdate}
                isEditing={editingMessageId === message.id}
                onEditStart={handleEditStart}
                onEditCancel={handleEditCancel}
              />
            ))}
          </div>
        )}
      </div>

      <ChatInput onSendMessage={handleSendMessage} disabled={isStreaming} />
    </div>
  );
}