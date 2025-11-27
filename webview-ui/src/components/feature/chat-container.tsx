import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageBubble } from '../ui/message-bubble';
import { ChatInput } from '../ui/chat-input';
import { ChatEmptyState } from '../ui/chat-empty-state';
import { Dropdown } from '../ui/dropdown';
import { HistoryDropdown } from './history-dropdown';
import { useStreamingChat } from '../../hooks/use-streaming-chat';
import { useTodo } from '../../hooks/use-todo';
import type { TodoTask } from '../../types/todo';
import type { ImageAttachment } from '../../types/chat';
import type { ChatMode } from '../../types/chat-mode';
import { storageService } from '../../utils/storage';

export function ChatContainer() {
  const { tasks, updateTodos, clearTodos } = useTodo();
  const [mode, setMode] = useState<ChatMode>(() => storageService.getChatMode());

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
  } = useStreamingChat(tasks, mode);
  const autoStartImplementationRef = useRef(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const isAutoScrollEnabledRef = useRef(isAutoScrollEnabled);

  // Filter out hidden messages (tool result feedback messages)
  const visibleMessages = messages.filter(msg => !msg.hidden);

  // Scroll to bottom helper
  const scrollToBottom = (options?: { behavior?: 'auto' | 'smooth' }) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: options?.behavior || 'smooth'
      });
    }
  };

  // Check if user is near bottom
  const isNearBottom = () => {
    if (!scrollContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    return distanceToBottom < 40;
  };

  // Handle scroll event to track user scroll position
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop } = container;
    const previousScrollTop = lastScrollTopRef.current;
    const isScrollingUp = scrollTop < previousScrollTop;

    lastScrollTopRef.current = scrollTop;

    if (isScrollingUp) {
      if (isAutoScrollEnabled) {
        setIsAutoScrollEnabled(false);
      }
      return;
    }

    if (isNearBottom()) {
      if (!isAutoScrollEnabled) {
        setIsAutoScrollEnabled(true);
      }
    }
  };

  // Define handleSendMessage before useEffect hooks that use it
  const handleSendMessage = useCallback(async (content: string, attachments?: ImageAttachment[], isHidden: boolean = false) => {
    await sendMessage(content, attachments, undefined, isHidden);
    // Force scroll to bottom when user sends a message
    setIsAutoScrollEnabled(true);
    // Use requestAnimationFrame to ensure DOM has updated before scrolling
    requestAnimationFrame(() => {
      setTimeout(() => scrollToBottom({ behavior: 'smooth' }), 50);
    });
  }, [sendMessage]);

  // Define handleModeChange before useEffect hooks that use it
  const handleModeChange = useCallback((newMode: ChatMode) => {
    setMode(newMode);
    storageService.setChatMode(newMode);
  }, []);

  // Extract todos from tool executions (any status: pending, executing, completed)
  useEffect(() => {
    let mostRecentTodoWrite: { tasks: TodoTask[]; timestamp: number } | null = null;
    
    // Find the most recent todo_write execution across all messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.toolExecutions) {
        for (const execution of msg.toolExecutions.values()) {
          // Check for ANY todo_write tool execution (pending, executing, completed)
          if (execution.toolName === 'todo_write') {
            // Use execution-level timestamp (completedAt > startedAt > message timestamp)
            // This ensures we pick the LATEST todo_write even when multiple exist in one message
            const execTimestamp = execution.completedAt ?? execution.startedAt ?? 
              (msg.timestamp instanceof Date ? msg.timestamp.getTime() : new Date(msg.timestamp).getTime());
            
            let tasks: TodoTask[] | null = null;

            // For completed executions, get tasks from result.data
            if (execution.status === 'completed' && 
                execution.result?.success &&
                execution.result.data) {
              const data = execution.result.data as { tasks?: unknown[] };
              if (data.tasks && Array.isArray(data.tasks)) {
                tasks = data.tasks as TodoTask[];
              }
            } 
            // For pending/executing executions, get tasks from parameters
            else if ((execution.status === 'pending' || execution.status === 'executing') && 
                     execution.parameters?.tasks) {
              const paramTasks = execution.parameters.tasks;
              if (Array.isArray(paramTasks)) {
                tasks = paramTasks as TodoTask[];
              }
            }

            // Keep track of the most recent todo_write using execution timestamp
            if (tasks && (!mostRecentTodoWrite || execTimestamp > mostRecentTodoWrite.timestamp)) {
              mostRecentTodoWrite = {
                tasks,
                timestamp: execTimestamp
              };
            }
          }
        }
      }
    }
    
    // Update todos with the most recent state, or clear if none found
    if (mostRecentTodoWrite) {
      updateTodos(mostRecentTodoWrite.tasks);
    } else if (messages.length === 0) {
      // Clear todos when no messages (new chat)
      updateTodos([]);
    }
  }, [messages, updateTodos]);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'newChat') {
        clearChat();
        clearTodos();
        handleModeChange('plan');
      } else if (message.type === 'openHistory') {
        setIsHistoryOpen(true);
      } else if (message.type === 'closeHistory') {
        setIsHistoryOpen(false);
      } else if (message.type === 'sessionLoaded') {
        // When a session is loaded, scroll to bottom after a short delay
        // to ensure the messages have rendered
        setTimeout(() => {
          setIsAutoScrollEnabled(true);
          scrollToBottom({ behavior: 'smooth' });
        }, 100);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearChat, clearTodos, handleModeChange]);

  // Listen for plan navigator quick questions
  useEffect(() => {
    const handleQuickQuestion = (event: Event) => {
      const custom = event as CustomEvent<{ question: string; selectedIndex: number }>;
      const question = custom.detail?.question;
      const selectedIndex = custom.detail?.selectedIndex;
      if (!question) return;
      
      // Update the plan_navigator tool result data with selectedIndex
      if (selectedIndex !== undefined) {
        updateToolResultData('plan_navigator', (data) => ({
          ...(typeof data === 'object' && data !== null ? data : {}),
          selectedIndex,
        }));
      }
      
      // Send as hidden message so it doesn't appear as a user bubble
      void handleSendMessage(question, undefined, true);
    };

    window.addEventListener('echode:quickQuestion', handleQuickQuestion as EventListener);
    return () => window.removeEventListener('echode:quickQuestion', handleQuickQuestion as EventListener);
  }, [handleSendMessage, updateToolResultData]);

  // Listen for plan implementation handoff
  useEffect(() => {
    const handleImplementHandoff = (event: Event) => {
      const customEvent = event as CustomEvent<{ markAsClicked?: boolean }>;
      const shouldMarkClicked = customEvent.detail?.markAsClicked;
      
      // Mark the plan_handoff tool as clicked in its result data
      if (shouldMarkClicked) {
        updateToolResultData('plan_handoff', (data) => ({
          ...(typeof data === 'object' && data !== null ? data : {}),
          clicked: true,
        }));
      }
      
      // Switch to agent mode first
      handleModeChange('agent');
      
      // Flag that implementation should auto-start after mode switches to agent
      autoStartImplementationRef.current = true;
    };

    window.addEventListener('echode:planImplementHandoff', handleImplementHandoff as EventListener);
    return () => window.removeEventListener('echode:planImplementHandoff', handleImplementHandoff as EventListener);
  }, [handleModeChange, updateToolResultData]);

  // Auto-start implementation after mode switches to Agent
  // This effect runs AFTER React re-renders with mode='agent', ensuring
  // that sendMessage uses the Agent-mode system prompt and tools
  useEffect(() => {
    if (mode !== 'agent' || !autoStartImplementationRef.current) {
      return;
    }

    autoStartImplementationRef.current = false;

    // Use setTimeout to avoid calling setState synchronously within effect
    setTimeout(() => {
      void handleSendMessage('Yes, proceed with the implementation as planned.', undefined, true);
    }, 0);
  }, [mode, handleSendMessage]);

  useEffect(() => {
    isAutoScrollEnabledRef.current = isAutoScrollEnabled;
  }, [isAutoScrollEnabled]);

  // Scroll editing message into view when edit mode starts
  useEffect(() => {
    if (editingMessageId && scrollContainerRef.current) {
      // Wait for edit form to render, then scroll into view
      setTimeout(() => {
        const editingElement = scrollContainerRef.current?.querySelector(
          `[data-message-id="${editingMessageId}"]`
        );
        if (editingElement) {
          editingElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 50);
    }
  }, [editingMessageId]);

  // Auto-scroll when messages change (new messages or streaming updates)
  useEffect(() => {
    const currentMessageCount = visibleMessages.length;
    const previousMessageCount = lastMessageCountRef.current;
    const hasNewMessage = currentMessageCount > previousMessageCount;
    const isStreamingUpdate =
      currentMessageCount === previousMessageCount && (isStreaming || isExecutingTool);

    if (currentMessageCount > 0) {
      requestAnimationFrame(() => {
        if (!isAutoScrollEnabledRef.current) return;
        if (!isNearBottom()) return;
        scrollToBottom({ behavior: hasNewMessage || !isStreamingUpdate ? 'smooth' : 'auto' });
      });
    }

    lastMessageCountRef.current = currentMessageCount;
  }, [visibleMessages, isStreaming, isExecutingTool, isAutoScrollEnabled]);

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

  const handleEdit = async (messageId: string, newContent: string, attachments?: ImageAttachment[]) => {
    // editMessage already clears editingMessageId internally
    await editMessage(messageId, newContent, attachments);
  };

  const handleUpdate = (messageId: string, newContent: string) => {
    updateMessage(messageId, newContent);
    handleEditCancel();
  };

  return (
    <>
      {/* Dimmed overlay when in edit mode */}
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
          className="flex-1 overflow-y-auto py-2 px-1"
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
                  />
                );
              })}
              {/* Bottom spacer for comfortable spacing above chat input */}
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