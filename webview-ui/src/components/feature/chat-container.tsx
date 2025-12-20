import { useCallback, useEffect } from 'react';
import type { ImageAttachment, Message } from '../../types/chat';
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
import { useTodoExtraction } from '../../hooks/use-todo-extraction';
import { useContextUsage } from '../../hooks/use-context-usage';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { getSystemPrompt } from '../../utils/prompts';
import { storageService } from '../../utils/storage';

export function ChatContainer() {
  const { tasks, updateTodos, clearTodos } = useTodo();
  
  // Get current chat mode
  const { mode, handleModeChange, setHotkeyDisabled } = useChatMode();
  
  // Per-mode model selection (each mode can have its own model)
  const { provider, model, setActiveProviderAndModel } = useChatModel(mode);

  const contentWidthClass = 'w-full max-w-3xl';
  const horizontalPaddingClass = 'px-4 sm:px-5 lg:px-6';

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
    saveCurrentSession,
    abortedUserInput,
    abortedAttachments,
    abortedImageAttachments,
  } = useStreamingChat(tasks, mode, handleModeChange);

  // Disable mode switching hotkey (Ctrl+.) when AI is actively streaming or executing tools
  useEffect(() => {
    setHotkeyDisabled(isStreaming || isExecutingTool);
  }, [isStreaming, isExecutingTool, setHotkeyDisabled]);

  // Context usage tracking
  const workspace = useWorkspaceContext();
  const settings = storageService.getSettings();
  const systemPrompt = getSystemPrompt(workspace, mode);
  const contextUsage = useContextUsage({
    systemPrompt,
    messages,
    contextSettings: settings.contextSettings,
    revertPreviewMessageId,
  });

  const visibleMessages = messages.filter(msg => !msg.hidden);
  const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
  const lastMessageKey = lastVisibleMessage ? `${lastVisibleMessage.id}:${lastVisibleMessage.content.length}` : '';


  const {
    scrollContainerRef,
    handleScroll,
    scrollToBottom,
    setIsAutoScrollEnabled,
  } = useChatScroll(visibleMessages.length, lastMessageKey, isStreaming, isExecutingTool);

  const handleSendMessage = useCallback(async (
    content: string,
    attachments?: ImageAttachment[],
    forceEchoSearch: boolean = false,
    overrideMessages?: Message[]
  ) => {
    // Enable auto-scroll when user sends a message
    setIsAutoScrollEnabled(true);
    // Attachments are now embedded in content as <attached_file> blocks
    // Pass overrideMessages to bypass stale closure (e.g., for refactor flow)
    sendMessage(content, attachments, overrideMessages, false, forceEchoSearch);
    // Scroll after a brief delay to ensure assistant placeholder (loading dots) is rendered
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

    // Also clear backend todos (they are stored separately in the extension)
    window.vscode.postMessage({ type: 'clearTodos' });
  }, [abortStream, clearChat, clearTodos, messages, saveCurrentSession]);

  const {
    isHistoryOpen,
    closeHistory,
  } = useExtensionMessages({
    onNewChat,
    onSessionLoaded: () => { /* Session load handled internally */ },
    scrollContainerRef,
    setIsAutoScrollEnabled,
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

  const handleEdit = async (messageId: string, newContent: string, imageAttachments?: ImageAttachment[], forceEchoSearch?: boolean) => {
    // Pass image attachments to editMessage for the AI request
    await editMessage(messageId, newContent, imageAttachments, forceEchoSearch);
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
          className={`flex-1 ${editingMessageId ? 'overflow-y-hidden' : 'overflow-y-auto'}`}
          style={{ scrollbarGutter: 'stable' }}
        >
          {visibleMessages.length === 0 ? (
            <div className={`${contentWidthClass} mx-auto h-full py-3 sm:py-4 lg:py-6 ${horizontalPaddingClass}`}>
              <ChatEmptyState />
            </div>
          ) : (
            <div className={`${contentWidthClass} mx-auto py-3 sm:py-4 lg:py-6 ${horizontalPaddingClass}`}>
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
                      contextUsage={contextUsage}
                    />
                  );
                })}
                <div className="h-4 sm:h-6 lg:h-8" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>

        <div className={`${horizontalPaddingClass}`} style={{ paddingRight: 'calc(1rem + 8px)' }}>
          <div className={`${contentWidthClass} mx-auto`}>
            <ChatInput
              key={
                abortedUserInput ||
                (abortedAttachments ? `attachments-${abortedAttachments.length}` : '') ||
                (abortedImageAttachments ? `images-${abortedImageAttachments.length}` : '') ||
                'default'
              }
              onSendMessage={handleSendMessage}
              onNewChat={onNewChat}
              isStreaming={isStreaming}
              isExecutingTool={isExecutingTool}
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
