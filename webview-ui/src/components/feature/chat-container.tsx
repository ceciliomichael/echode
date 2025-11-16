import { useState, useEffect } from 'react';
import { MessageBubble } from '../ui/message-bubble';
import { ChatInput } from '../ui/chat-input';
import { ChatEmptyState } from '../ui/chat-empty-state';
import { useStreamingChat } from '../../hooks/use-streaming-chat';

export function ChatContainer() {
  const { messages, isStreaming, sendMessage, editMessage, updateMessage, clearChat, abortStream } = useStreamingChat();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const lastAssistantIndex = messages.reduce((lastIndex, msg, index) =>
    msg.role === 'assistant' ? index : lastIndex,
    -1
  );


  // Listen for new chat message from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'newChat') {
        clearChat();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearChat]);

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
          <div className="space-y-3">
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                onEdit={handleEdit}
                onUpdate={handleUpdate}
                isEditing={editingMessageId === message.id}
                onEditStart={handleEditStart}
                onEditCancel={handleEditCancel}
                isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
                showCopy={index === lastAssistantIndex}
              />
            ))}
          </div>
        )}
      </div>

      <ChatInput 
        onSendMessage={handleSendMessage} 
        isStreaming={isStreaming}
        onStop={abortStream}
      />
    </div>
  );
}