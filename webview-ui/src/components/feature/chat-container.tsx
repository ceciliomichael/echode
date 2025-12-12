import { useCallback } from 'react';
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
    saveCurrentSession,
    abortedUserInput,
    abortedAttachments,
    abortedImageAttachments,
  } = useStreamingChat(tasks, mode);

  // Context usage tracking
  const workspace = useWorkspaceContext();
  const settings = storageService.getSettings();
  const systemPrompt = getSystemPrompt(workspace, mode);
  const contextUsage = useContextUsage({
    systemPrompt,
    messages,
    contextSettings: settings.contextSettings,
  });

  const visibleMessages = messages.filter(msg => !msg.hidden);
  const lastVisibleMessage = visibleMessages[visibleMessages.length - 1];
  const lastMessageKey = lastVisibleMessage ? `${lastVisibleMessage.id}:${lastVisibleMessage.content.length}` : '';

  const hasPlanningTool = (message: typeof messages[number]): boolean => {
    if (message.role !== 'assistant' || !message.toolExecutions) {
      return false;
    }

    for (const execution of message.toolExecutions.values()) {
      if (execution.toolName === 'plan_navigator' || execution.toolName === 'plan_handoff') {
        return true;
      }
    }

    return false;
  };

  const startsWithPlanningTool = (message: typeof messages[number]): boolean => {
    if (!hasPlanningTool(message)) return false;
    // Check if content starts with a planning tool (ignoring leading whitespace)
    // We look for <function_calls> or <invoke name="plan_navigator"/"plan_handoff">
    // Note: This matches the tokenizer logic
    const content = message.content.trimStart();

    // Check for function_calls block or direct invoke
    if (content.startsWith('<function_calls>') || content.startsWith('<invoke')) {
      // We need to verify if the first tool is actually a planning tool
      // This is a simplified check - we assume if it starts with a tool block and contains a planning tool, 
      // the planning tool is likely first or part of the first block. 
      // For exact precision we'd need to parse, but this is a purely visual heuristic.
      return true;
    }
    return false;
  };

  const endsWithPlanningTool = (message: typeof messages[number]): boolean => {
    if (!hasPlanningTool(message)) return false;
    // Check if content ends with a planning tool (ignoring trailing whitespace)
    const content = message.content.trimEnd();
    return content.endsWith('</function_calls>') || content.endsWith('</invoke>');
  };

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

                  // Determine if this assistant message participates in a planning tool chain
                  let planChainPosition: { connectTop: boolean; connectBottom: boolean } | undefined;
                  if (hasPlanningTool(message)) {
                    const prevMsg = index > 0 ? visibleMessages[index - 1] : undefined;
                    const nextMsg = index < visibleMessages.length - 1 ? visibleMessages[index + 1] : undefined;

                    // Only connect TOP if:
                    // 1. A previous message exists
                    // 2. Previous message ENDS with a planning tool
                    // 3. Current message STARTS with a planning tool
                    const connectTop = !!(prevMsg && endsWithPlanningTool(prevMsg) && startsWithPlanningTool(message));

                    // Only connect BOTTOM if:
                    // 1. A next message exists
                    // 2. Next message STARTS with a planning tool
                    // 3. Current message ENDS with a planning tool
                    const connectBottom = !!(nextMsg && startsWithPlanningTool(nextMsg) && endsWithPlanningTool(message));

                    if (connectTop || connectBottom) {
                      planChainPosition = { connectTop, connectBottom };
                    }
                  }

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
                      planChainPosition={planChainPosition}
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
