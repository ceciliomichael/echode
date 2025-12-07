import { useCallback } from 'react';
import type { ImageAttachment } from '../../types/chat';
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
import { useContextUsage } from '../../hooks/use-context-usage';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { getSystemPrompt } from '../../utils/prompts';
import { storageService } from '../../utils/storage';

export function ChatContainer() {
  const { tasks, updateTodos, clearTodos } = useTodo();
  const { mode, handleModeChange } = useChatMode();
  const { provider, model, setActiveProviderAndModel } = useChatModel();

  const contentWidthClass = 'w-full max-w-3xl';
  const horizontalPaddingClass = 'px-4 sm:px-5 lg:px-6';

  const { 
    messages, 
    isStreaming, 
    isExecutingTool,
    isCompressing,
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
    saveCurrentSession,
    abortedUserInput,
    abortedAttachments,
    abortedImageAttachments,
    compressedContextTokens,
  } = useStreamingChat(tasks, mode);

  // Context usage tracking
  const workspace = useWorkspaceContext();
  const settings = storageService.getSettings();
  const systemPrompt = getSystemPrompt(workspace, mode);
  const contextUsage = useContextUsage({
    systemPrompt,
    messages,
    contextSettings: settings.contextSettings,
    compressedContextTokens,
  });

  const visibleMessages = messages.filter(msg => !msg.hidden);
  const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
  const lastMessageKey = lastVisibleMessage ? `${lastVisibleMessage.id}:${lastVisibleMessage.content.length}` : '';

  const {
    scrollContainerRef,
    handleScroll,
    scrollToBottom,
    setIsAutoScrollEnabled,
  } = useChatScroll(visibleMessages.length, lastMessageKey, isStreaming, isExecutingTool || isCompressing);

  const handleSendMessage = useCallback(async (
    content: string, 
    attachments?: ImageAttachment[], 
    forceEchoSearch: boolean = false
  ) => {
    supersedePlanningTools();
    // Enable auto-scroll when user sends a message
    setIsAutoScrollEnabled(true);
    // Attachments are now embedded in content as <attached_file> blocks
    sendMessage(content, attachments, undefined, false, forceEchoSearch);
    // Scroll after a brief delay to ensure assistant placeholder (loading dots) is rendered
    setTimeout(() => {
      scrollToBottom({ behavior: 'smooth' });
    }, 100);
  }, [sendMessage, supersedePlanningTools, setIsAutoScrollEnabled, scrollToBottom]);

  const handleSendHiddenMessage = useCallback(async (content: string) => {
    setIsAutoScrollEnabled(true);
    sendMessage(content, undefined, undefined, true, false);
    setTimeout(() => {
      scrollToBottom({ behavior: 'smooth' });
    }, 100);
  }, [sendMessage, setIsAutoScrollEnabled, scrollToBottom]);

  const onNewChat = useCallback(() => {
    // Persist the current session (if any messages) before starting a new chat
    if (messages.length > 0) {
      saveCurrentSession(messages);
    }

    abortStream();
    clearChat();
    clearTodos();
    handleModeChange('agent');
  }, [abortStream, clearChat, clearTodos, handleModeChange, messages, saveCurrentSession]);

  const {
    isHistoryOpen,
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

  const handleEdit = async (messageId: string, newContent: string, _attachments?: undefined, forceEchoSearch?: boolean) => {
    // Attachments are now embedded in content as <attached_file> blocks
    await editMessage(messageId, newContent, undefined, forceEchoSearch);
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
        className={`flex-1 py-3 sm:py-4 lg:py-6 ${horizontalPaddingClass} ${editingMessageId ? 'overflow-y-hidden' : 'overflow-y-auto'}`}
        >
          {visibleMessages.length === 0 ? (
          <div className={`${contentWidthClass} mx-auto h-full`}>
              <ChatEmptyState />
            </div>
          ) : (
          <div className={`${contentWidthClass} mx-auto`}>
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
                    isStreaming={(isStreaming || isExecutingTool || isCompressing) && isLastAssistantMessage}
                    isCompressing={isCompressing && isLastAssistantMessage}
                    mode={mode}
                    onModeChange={handleModeChange}
                    provider={provider}
                    model={model}
                    onModelChange={setActiveProviderAndModel}
                    contextUsage={contextUsage}
                  />
                );
              })}
                <div className="h-4 sm:h-6 lg:h-8" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>

        <div className={`${horizontalPaddingClass}`}>
          <div className={`${contentWidthClass} mx-auto`}>
            <ChatInput 
              key={
                abortedUserInput ||
                (abortedAttachments ? `attachments-${abortedAttachments.length}` : '') ||
                (abortedImageAttachments ? `images-${abortedImageAttachments.length}` : '') ||
                'default'
              }
              onSendMessage={handleSendMessage} 
              isStreaming={isStreaming}
              isExecutingTool={isExecutingTool}
              isCompressing={isCompressing}
              onStop={abortStream}
              todos={tasks}
              mode={mode}
              onModeChange={handleModeChange}
              provider={provider}
              model={model}
              onModelChange={setActiveProviderAndModel}
              contextUsage={contextUsage}
              restoredInput={abortedUserInput ?? undefined}
              restoredAttachments={abortedAttachments ?? undefined}
              restoredImageAttachments={abortedImageAttachments ?? undefined}
            />
          </div>
        </div>
      </div>

      <Dropdown
        isOpen={isHistoryOpen}
        onClose={closeHistory}
        variant="fullwidth"
      >
        <HistoryDropdown
          onLoadSession={loadSession}
          onClose={closeHistory}
        />
      </Dropdown>
    </>
  );
}
