import { useCallback, useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ImageAttachment, Message, QueuedMessage } from '../../types/chat';
import type { ChatMode } from '../../types/chat-mode';
import { MessageBubble } from '../ui/message-bubble';
import { ChatInput } from '../ui/chat-input';
import { ChatEmptyState } from '../ui/chat-empty-state';
import { ChatSkeletonLoader } from '../ui/chat-skeleton-loader';
import { Dropdown } from '../ui/dropdown';
import { HistoryDropdown } from './history-dropdown';
import { useStreamingChat } from '../../hooks/use-streaming-chat';
import { useTodo } from '../../hooks/use-todo';
import { summarizeSubAgentSession } from '../../services/sub-agent-summarizer';
import { vscode } from '../../utils/vscode';
import { useChatModel } from '../../hooks/use-chat-model';
import { useChatMode } from '../../hooks/use-chat-mode';
import { useExtensionMessages } from '../../hooks/use-extension-messages';
import { useTodoExtraction } from '../../hooks/use-todo-extraction';
import { useContextUsage } from '../../hooks/use-context-usage';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { useCompressionHandler } from '../../hooks/use-compression-handler';
import { useAutoScroll } from '../../hooks/use-auto-scroll';
import { useChatHistory } from '../../hooks/use-chat-history';
import { getSystemPrompt } from '../../utils/prompts';
import { storageService } from '../../utils/storage';

interface ChatContainerProps {
  subAgentConfig?: {
    enabled: boolean;
    initialTask: string;
  };
}

export function ChatContainer({ subAgentConfig }: ChatContainerProps) {
  const { tasks, updateTodos, clearTodos } = useTodo();
  
  // Get current chat mode
  const { mode, handleModeChange: globalHandleModeChange } = useChatMode();
  
  // Per-mode model selection (each mode can have its own model)
  const { provider, model, setActiveProviderAndModel } = useChatModel(mode);

  // Chat history for recent sessions display in empty state
  const { sessions } = useChatHistory();
  const recentSessions = sessions.slice(0, 3);

  // Message queue state - allows users to queue messages while AI is working
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const isProcessingQueueRef = useRef(false);
  
  // Sub-agent auto-start tracking
  const hasStartedRef = useRef(false);
  // Track completed message to avoid duplicate summarization
  const completedMessageIdRef = useRef<string | null>(null);
  // Track summarization state
  const [isSummarizing, setIsSummarizing] = useState(false);

  const contentWidthClass = 'w-full max-w-3xl';
  const horizontalPaddingClass = 'px-4 sm:px-5 lg:px-6';

  const {
    messages,
    isStreaming,
    isExecutingTool,
    isLoadingSession,
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
  } = useStreamingChat(tasks, mode, globalHandleModeChange, subAgentConfig);

  // Wrap mode change to abort any active streaming/tool execution first
  // This prevents "stuck" states when switching modes mid-execution
  const handleModeChange = useCallback((newMode: ChatMode) => {
    // Do not abort stream on mode change - allow user to switch context for next message
    // while current one finishes
    globalHandleModeChange(newMode);
  }, [globalHandleModeChange]);

  // Context usage tracking
  const workspace = useWorkspaceContext();
  const settings = storageService.getSettings();
  
  // For YOLO mode, derive the "effective mode" from the last assistant message
  // This reflects the internal mode transition (plan -> agent) after handoff
  const effectiveMode = (() => {
    if (subAgentConfig?.enabled) return 'sub-agent';
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

  // Auto-scroll: scrolls to bottom on new content unless user has scrolled up
  // Disable auto-scroll when editing to prevent jumping when the edit form expands content
  useAutoScroll(scrollContainerRef, visibleMessages, !editingMessageId);

  // Direct send function (bypasses queue, used for queue processing)
  const sendMessageDirect = useCallback(async (
    content: string,
    attachments?: ImageAttachment[],
    overrideMessages?: Message[]
  ) => {
    sendMessage(content, attachments, overrideMessages, false);
  }, [sendMessage]);

  // Add message to queue
  const addToQueue = useCallback((
    content: string,
    imageAttachments?: ImageAttachment[]
  ) => {
    const queuedMessage: QueuedMessage = {
      id: uuidv4(),
      content,
      imageAttachments,
      timestamp: new Date(),
    };
    setQueuedMessages(prev => [...prev, queuedMessage]);
  }, []);

  // Remove message from queue
  const removeFromQueue = useCallback((id: string) => {
    setQueuedMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  // Update a queued message content/attachments
  const updateQueueMessage = useCallback((id: string, content: string, imageAttachments?: ImageAttachment[]) => {
    setQueuedMessages(prev => prev.map(msg => 
      msg.id === id 
        ? { ...msg, content, imageAttachments: imageAttachments ?? msg.imageAttachments }
        : msg
    ));
  }, []);

  // Force send a specific queued message immediately (stops current work, sends this message)
  const forceSendQueueMessage = useCallback((id: string) => {
    const messageToSend = queuedMessages.find(msg => msg.id === id);
    if (!messageToSend) return;

    // Remove from queue
    setQueuedMessages(prev => prev.filter(msg => msg.id !== id));

    // Abort current stream if running
    abortStream();

    // Small delay to ensure abort settles, then send
    setTimeout(() => {
      sendMessageDirect(
        messageToSend.content,
        messageToSend.imageAttachments
      );
    }, 200);
  }, [queuedMessages, abortStream, sendMessageDirect]);

  // Clear all queued messages (used for force send)
  const clearQueue = useCallback(() => {
    setQueuedMessages([]);
  }, []);

  // Sub-agent auto-start logic
  useEffect(() => {
    if (
      subAgentConfig?.enabled &&
      !isLoadingSession &&
      !isStreaming &&
      !isExecutingTool &&
      !hasStartedRef.current &&
      // Wait for session to be loaded (messages should include system prompt)
      messages.length > 0 &&
      // Only start if we haven't already processed the initial task
      messages.filter(m => !m.hidden).length <= 1
    ) {
      hasStartedRef.current = true;
      // Small delay to ensure everything is ready
      setTimeout(() => {
        sendMessageDirect(subAgentConfig.initialTask, undefined, undefined);
      }, 500);
    }
  }, [subAgentConfig, isLoadingSession, isStreaming, isExecutingTool, messages, sendMessageDirect]);

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
            nextMessage.imageAttachments
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
    overrideMessages?: Message[]
  ) => {
    const isAiWorking = isStreaming || isExecutingTool || isCompressing;
    
    // If AI is busy, queue the message (unless overrideMessages is provided for special flows)
    if (isAiWorking && overrideMessages === undefined) {
      addToQueue(content, attachments);
      return;
    }
    
    // Otherwise send directly
    sendMessageDirect(content, attachments, overrideMessages);
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

  // Automatic sub-agent completion detection
  useEffect(() => {
    if (!subAgentConfig?.enabled) return;

    // Only run if we have started (initial task sent)
    if (!hasStartedRef.current) return;

    // Check if system is busy
    if (isStreaming || isExecutingTool || isCompressing || isLoadingSession) return;

    // Check if the last message is from assistant
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;

    // Check if we already completed (avoid loop)
    if (completedMessageIdRef.current === lastMsg.id) return;

    const timer = setTimeout(async () => {
      // Mark as completing/completed to prevent duplicate firing
      completedMessageIdRef.current = lastMsg.id;
      
      setIsSummarizing(true);

      try {
        const summary = await summarizeSubAgentSession(messages, subAgentConfig.initialTask);
        vscode.postMessage({
          type: 'completeSubAgentSession',
          summary
        });
      } catch (error) {
        console.error('Failed to auto-complete sub-agent session:', error);
      } finally {
        setIsSummarizing(false);
      }
    }, 2000); // 2 second debounce to ensure no further activity

    return () => clearTimeout(timer);
  }, [subAgentConfig, isStreaming, isExecutingTool, isCompressing, isLoadingSession, messages, hasStartedRef]);

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
    // Clear queue when reverting to prevent pending messages from being sent in the new context
    clearQueue();
    await handleRevertPreview(messageId);
  };

  const handleEdit = async (messageId: string, newContent: string, imageAttachments?: ImageAttachment[]) => {
    // Pass image attachments to editMessage for the AI request
    await editMessage(messageId, newContent, imageAttachments);
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
            backdropFilter: 'blur(0.5px)',
            pointerEvents: 'none'
          }}
        />
      )}

      <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--vscode-sideBar-background)' }}>
        <div
          ref={scrollContainerRef}
          data-chat-scroll-container="true"
          data-chat-message-list-boundary="true"
          className="flex-1 overflow-y-auto"
          style={{
            scrollbarGutter: 'stable',
            overflowAnchor: 'none',
          }}
          onClick={() => {
            if (editingMessageId) {
              handleCancel();
            }
          }}
        >
          {isLoadingSession ? (
            <div className={`${contentWidthClass} mx-auto h-full py-3 sm:py-4 lg:py-6 ${horizontalPaddingClass}`}>
              <ChatSkeletonLoader />
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className={`${contentWidthClass} mx-auto h-full py-3 sm:py-4 lg:py-6 ${horizontalPaddingClass}`}>
              <ChatEmptyState 
                recentSessions={recentSessions}
                onLoadSession={loadSession}
              />
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
              disabled={!!editingMessageId}
              onSendMessage={handleSendMessage}
              onNewChat={onNewChat}
              isStreaming={isStreaming}
              isExecutingTool={isExecutingTool}
              onStop={abortStream}
              queuedMessages={queuedMessages}
              onRemoveFromQueue={removeFromQueue}
              onUpdateQueueMessage={updateQueueMessage}
              onForceSendQueueMessage={forceSendQueueMessage}
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
              subAgentMode={subAgentConfig?.enabled}
              isSummarizing={isSummarizing}
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
