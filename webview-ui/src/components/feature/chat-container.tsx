import { useCallback, useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ImageAttachment, Message, QueuedMessage } from '../../types/chat';
import { MessageBubble } from '../ui/message-bubble';
import { ChatInput } from '../ui/chat-input';
import { ChatEmptyState } from '../ui/chat-empty-state';
import { Dropdown } from '../ui/dropdown';
import { HistoryDropdown } from './history-dropdown';
import { useStreamingChat } from '../../hooks/use-streaming-chat';
import { useTodo } from '../../hooks/use-todo';
import { useChatModel } from '../../hooks/use-chat-model';
import { useChatMode } from '../../hooks/use-chat-mode';
import { useExtensionMessages } from '../../hooks/use-extension-messages';
import { useTodoExtraction } from '../../hooks/use-todo-extraction';
import { useContextUsage } from '../../hooks/use-context-usage';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useCompressionHandler } from '../../hooks/use-compression-handler';
import { getSystemPrompt } from '../../utils/prompts';
import { storageService } from '../../utils/storage';

export function ChatContainer() {
  const { tasks, updateTodos, clearTodos } = useTodo();
  
  // Get current chat mode
  const { mode, handleModeChange, setHotkeyDisabled } = useChatMode();
  
  // Per-mode model selection (each mode can have its own model)
  const { provider, model, setActiveProviderAndModel } = useChatModel(mode);

  // Message queue state - allows users to queue messages while AI is working
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const isProcessingQueueRef = useRef(false);

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
  
  // For YOLO mode, derive the "effective mode" from the last assistant message
  // This reflects the internal mode transition (plan -> agent) after handoff
  const effectiveMode = (() => {
    if (mode !== 'yolo') return mode;
    
    // Find the last assistant message to check its internal mode
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
    if (lastAssistantMessage?.mode === 'agent') {
      return 'agent'; // YOLO has transitioned to agent internally
    }
    return 'plan'; // YOLO starts as plan mode
  })();
  
  const systemPrompt = getSystemPrompt(workspace, effectiveMode);
  const contextUsage = useContextUsage({
    systemPrompt,
    messages,
    mode: effectiveMode,
    contextSettings: settings.contextSettings,
    revertPreviewMessageId,
  });

  const visibleMessages = messages.filter(msg => !msg.hidden);

  // Scroll container refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  // Direct send function (bypasses queue, used for queue processing)
  const sendMessageDirect = useCallback(async (
    content: string,
    attachments?: ImageAttachment[],
    forceEchoSearch: boolean = false,
    overrideMessages?: Message[]
  ) => {
    sendMessage(content, attachments, overrideMessages, false, forceEchoSearch);
  }, [sendMessage]);

  // Add message to queue
  const addToQueue = useCallback((
    content: string,
    imageAttachments?: ImageAttachment[],
    forceEchoSearch: boolean = false
  ) => {
    const queuedMessage: QueuedMessage = {
      id: uuidv4(),
      content,
      imageAttachments,
      forceEchoSearch,
      timestamp: new Date(),
    };
    setQueuedMessages(prev => [...prev, queuedMessage]);
  }, []);

  // Remove message from queue
  const removeFromQueue = useCallback((id: string) => {
    setQueuedMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  // Clear all queued messages (used for force send)
  const clearQueue = useCallback(() => {
    setQueuedMessages([]);
  }, []);

  // Process queue when AI finishes working
  useEffect(() => {
    const isAiWorking = isStreaming || isExecutingTool || isCompressing;
    
    // When AI stops working and we have queued messages, process the next one
    if (!isAiWorking && queuedMessages.length > 0 && !isProcessingQueueRef.current) {
      isProcessingQueueRef.current = true;
      
      // Small delay to ensure state is settled
      const timeoutId = setTimeout(() => {
        const [nextMessage, ...remainingMessages] = queuedMessages;
        if (nextMessage) {
          setQueuedMessages(remainingMessages);
          sendMessageDirect(
            nextMessage.content,
            nextMessage.imageAttachments,
            nextMessage.forceEchoSearch ?? false
          );
        }
        isProcessingQueueRef.current = false;
      }, 150);

      return () => {
        clearTimeout(timeoutId);
        isProcessingQueueRef.current = false;
      };
    }
  }, [isStreaming, isExecutingTool, queuedMessages, sendMessageDirect]);

  // Main send handler - queues if AI is busy, sends directly otherwise
  const handleSendMessage = useCallback(async (
    content: string,
    attachments?: ImageAttachment[],
    forceEchoSearch: boolean = false,
    overrideMessages?: Message[]
  ) => {
    const isAiWorking = isStreaming || isExecutingTool || isCompressing;
    
    // If AI is busy, queue the message (unless overrideMessages is provided for special flows)
    if (isAiWorking && overrideMessages === undefined) {
      addToQueue(content, attachments, forceEchoSearch);
      return;
    }
    
    // Otherwise send directly
    sendMessageDirect(content, attachments, forceEchoSearch, overrideMessages);
  }, [isStreaming, isExecutingTool, addToQueue, sendMessageDirect]);

  const onNewChat = useCallback((preserveQueue: boolean = false) => {
    // Persist the current session (if any messages) before starting a new chat
    if (messages.length > 0) {
      saveCurrentSession(messages);
    }

    abortStream();
    clearChat();
    clearTodos();
    
    // Only clear queue if not preserving (e.g., during compression flow)
    if (!preserveQueue) {
      setQueuedMessages([]);
    }

    // Also clear backend todos (they are stored separately in the extension)
    window.vscode.postMessage({ type: 'clearTodos' });
  }, [abortStream, clearChat, clearTodos, messages, saveCurrentSession]);

  // Compression handler
  const { isCompressing, handleCompressHistory, handleCancelCompression } = useCompressionHandler({
    messages,
    onNewChat,
    sendMessage: handleSendMessage,
    saveCurrentSession,
  });

  // Disable compression if chat is empty OR only contains compressed history + AI response (essentially a new chat)
  // This prevents users from compressing an empty chat or an already compressed chat with no new meaningful content
  const shouldDisableCompress = messages.length === 0 || (messages.length <= 2 && 
    messages.length > 0 && 
    messages[0].role === 'user' && 
    messages[0].content.trimStart().startsWith('<compressed_history>'));

  const {
    isHistoryOpen,
    closeHistory,
  } = useExtensionMessages({
    onNewChat,
    onSessionLoaded: () => { /* Session load handled internally */ },
    scrollContainerRef,
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
          data-chat-scroll-container="true"
          data-chat-message-list-boundary="true"
          className={`flex-1 ${editingMessageId ? 'overflow-y-hidden' : 'overflow-y-auto'}`}
          style={{
            scrollbarGutter: 'stable',
            overflowAnchor: 'none',
          }}
        >
          {visibleMessages.length === 0 ? (
            <div className={`${contentWidthClass} mx-auto h-full py-3 sm:py-4 lg:py-6 ${horizontalPaddingClass}`}>
              <ChatEmptyState />
            </div>
          ) : (
            <div
              ref={scrollContentRef}
              className={`${contentWidthClass} mx-auto py-3 sm:py-4 lg:py-6 ${horizontalPaddingClass}`}
            >
              <div className="space-y-3">
                {visibleMessages.map((message, index) => {
                  const isLastAssistantMessage = index === visibleMessages.length - 1 && message.role === 'assistant';
                  const isFirstMessage = index === 0;

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
                      isLastMessage={isLastAssistantMessage}
                      isFirstMessage={isFirstMessage}
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
              queuedMessages={queuedMessages}
              onRemoveFromQueue={removeFromQueue}
              onClearQueue={clearQueue}
              mode={mode}
              onModeChange={handleModeChange}
              provider={provider}
              model={model}
              onModelChange={setActiveProviderAndModel}
              contextUsage={contextUsage}
              onCompress={handleCompressHistory}
              onCancelCompress={handleCancelCompression}
              isCompressing={isCompressing}
              disableCompress={shouldDisableCompress}
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
