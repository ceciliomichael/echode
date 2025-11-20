import { useState, useEffect } from 'react';
import { MessageBubble } from '../ui/message-bubble';
import { ChatInput } from '../ui/chat-input';
import { ChatEmptyState } from '../ui/chat-empty-state';
import { Dropdown } from '../ui/dropdown';
import { HistoryDropdown } from './history-dropdown';
import { useStreamingChat } from '../../hooks/use-streaming-chat';

export function ChatContainer() {
  const { 
    messages, 
    isStreaming, 
    isExecutingTool, 
    revertPreviewMessageId,
    editingMessageId,
    sendMessage, 
    editMessage, 
    updateMessage, 
    clearChat, 
    abortStream, 
    loadSession,
    handleEditStart,
    handleEditCancel,
    handleRevertPreview,
    handleCancelRevert,
  } = useStreamingChat();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Filter out hidden messages (tool result feedback messages)
  const visibleMessages = messages.filter(msg => !msg.hidden);

  const lastAssistantIndex = visibleMessages.reduce((lastIndex, msg, index) =>
    msg.role === 'assistant' ? index : lastIndex,
    -1
  );

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'newChat') {
        clearChat();
      } else if (message.type === 'openHistory') {
        setIsHistoryOpen(true);
      } else if (message.type === 'closeHistory') {
        setIsHistoryOpen(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearChat]);

  const handleSendMessage = async (content: string) => {
    await sendMessage(content);
  };

  const handleCancel = async () => {
    // If we're in a revert preview for the current editing message, cancel the revert
    if (revertPreviewMessageId && editingMessageId === revertPreviewMessageId) {
      await handleCancelRevert();
    } else {
      // Just clear editing state for normal edits
      handleEditCancel();
    }
  };

  const handleRevert = async (messageId: string) => {
    // handleRevertPreview already sets editingMessageId internally
    await handleRevertPreview(messageId);
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    // editMessage already clears editingMessageId internally
    await editMessage(messageId, newContent);
  };

  const handleUpdate = (messageId: string, newContent: string) => {
    updateMessage(messageId, newContent);
    handleEditCancel();
  };

  return (
    <>
      <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--vscode-sideBar-background)' }}>
        <div className="flex-1 overflow-y-auto py-2 px-1">
          {visibleMessages.length === 0 ? (
            <ChatEmptyState />
          ) : (
            <div className="space-y-3">
              {visibleMessages.map((message, index) => {
                const isLastAssistantMessage = index === visibleMessages.length - 1 && message.role === 'assistant';
                return (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onEdit={handleEdit}
                    onUpdate={handleUpdate}
                    isEditing={editingMessageId === message.id}
                    onEditStart={handleEditStart}
                    onEditCancel={handleCancel}
                    onRevert={handleRevert}
                    isStreaming={(isStreaming || isExecutingTool) && isLastAssistantMessage}
                    showCopy={index === lastAssistantIndex}
                  />
                );
              })}
            </div>
          )}
        </div>

        <ChatInput 
          onSendMessage={handleSendMessage} 
          isStreaming={isStreaming}
          onStop={abortStream}
        />
      </div>

      <Dropdown
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false);
          // Notify extension that history was closed via UI
          if (window.vscode) {
            window.vscode.postMessage({ type: 'historyPanelClosed' });
          }
        }}
      >
        <HistoryDropdown
          onLoadSession={loadSession}
          onClose={() => {
            setIsHistoryOpen(false);
            // Notify extension that history was closed via UI
            if (window.vscode) {
              window.vscode.postMessage({ type: 'historyPanelClosed' });
            }
          }}
        />
      </Dropdown>
    </>
  );
}