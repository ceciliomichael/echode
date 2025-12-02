import { useCallback } from 'react';
import { MessageBubble } from '../ui/message-bubble';
import { ChatInput } from '../ui/chat-input';
import { ChatEmptyState } from '../ui/chat-empty-state';
import { Dropdown } from '../ui/dropdown';
import { HistoryDropdown } from './history-dropdown';
import { useStreamingChat } from '../../hooks/use-streaming-chat';
import { useTodo } from '../../hooks/use-todo';
import { useChatModel } from '../../hooks/use-chat-model';
import { useChatMode } from '../../hooks/use-chat-mode';
import { useChatScroll } from '../../hooks/use-chat-scroll';
import { useExtensionMessages } from '../../hooks/use-extension-messages';
import { usePlanEvents } from '../../hooks/use-plan-events';
import { useTodoExtraction } from '../../hooks/use-todo-extraction';
import type { ImageAttachment } from '../../types/chat';

export function ChatContainer() {
  const { tasks, updateTodos, clearTodos } = useTodo();
  const { mode, handleModeChange } = useChatMode();
  const { provider, model, setActiveProviderAndModel } = useChatModel();

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
    updateToolResultData,
    supersedePlanningTools,
  } = useStreamingChat(tasks, mode);

  const visibleMessages = messages.filter(msg => !msg.hidden);

  const {
    scrollContainerRef,
    handleScroll,
    scrollToBottom,
    setIsAutoScrollEnabled,
  } = useChatScroll(visibleMessages.length, isStreaming, isExecutingTool);

  const handleSendMessage = useCallback(async (
    content: string, 
    attachments?: ImageAttachment[], 
    forceEchoSearch: boolean = false
  ) => {
    supersedePlanningTools();
    await sendMessage(content, attachments, undefined, false, forceEchoSearch);
    setIsAutoScrollEnabled(true);
    requestAnimationFrame(() => {
      setTimeout(() => scrollToBottom({ behavior: 'smooth' }), 50);
    });
  }, [sendMessage, supersedePlanningTools, setIsAutoScrollEnabled, scrollToBottom]);

  const handleSendHiddenMessage = useCallback(async (content: string) => {
    await sendMessage(content, undefined, undefined, true, false);
    setIsAutoScrollEnabled(true);
    requestAnimationFrame(() => {
      setTimeout(() => scrollToBottom({ behavior: 'smooth' }), 50);
    });
  }, [sendMessage, setIsAutoScrollEnabled, scrollToBottom]);

  const onNewChat = useCallback(() => {
    abortStream();
    clearChat();
    clearTodos();
    handleModeChange('agent');
  }, [abortStream, clearChat, clearTodos, handleModeChange]);

  const {
    isHistoryOpen,
    echoSearchEnabled,
    closeHistory,
  } = useExtensionMessages({
    onNewChat,
    onSessionLoaded: () => { /* Session load handled internally */ },
    scrollContainerRef,
    setIsAutoScrollEnabled,
  });

  usePlanEvents({
    mode,
    handleModeChange,
    handleSendHiddenMessage,
    updateToolResultData,
  });

  useTodoExtraction({
    messages,
    updateTodos,
  });

  const handleCancel = async () => {
    if (revertPreviewMessageId && editingMessageId === revertPreviewMessageId) {
      await handleCancelRevert();
    } else {
      handleEditCancel();
    }
  };

  const handleRevert = async (messageId: string) => {
    await handleRevertPreview(messageId);
  };

  const handleEdit = async (messageId: string, newContent: string, attachments?: ImageAttachment[]) => {
    await editMessage(messageId, newContent, attachments);
  };

  const handleUpdate = (messageId: string, newContent: string) => {
    updateMessage(messageId, newContent);
    handleEditCancel();
  };

  return (
    <>
      {editingMessageId && (
        <div
          className="fixed inset-0 z-40 transition-opacity"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)'
          }}
          onClick={handleCancel}
        />
      )}

      <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--vscode-sideBar-background)' }}>
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          data-chat-scroll-container="true"
          data-chat-message-list-boundary="true"
          className={`flex-1 py-2 px-1 ${editingMessageId ? 'overflow-y-hidden' : 'overflow-y-auto'}`}
        >
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
                    mode={mode}
                    onModeChange={handleModeChange}
                    provider={provider}
                    model={model}
                    onModelChange={setActiveProviderAndModel}
                  />
                );
              })}
              <div className="h-4 sm:h-6 lg:h-8" aria-hidden="true" />
            </div>
          )}
        </div>

        <ChatInput 
          onSendMessage={handleSendMessage} 
          isStreaming={isStreaming}
          onStop={abortStream}
          todos={tasks}
          mode={mode}
          onModeChange={handleModeChange}
          provider={provider}
          model={model}
          onModelChange={setActiveProviderAndModel}
          echoSearchEnabled={echoSearchEnabled}
        />
      </div>

      <Dropdown
        isOpen={isHistoryOpen}
        onClose={closeHistory}
      >
        <HistoryDropdown
          onLoadSession={loadSession}
          onClose={closeHistory}
        />
      </Dropdown>
    </>
  );
}
