import { useState, useEffect } from 'react';
import { MessageBubble } from '../ui/message-bubble';
import { ChatInput } from '../ui/chat-input';
import { ChatEmptyState } from '../ui/chat-empty-state';
import { Dropdown } from '../ui/dropdown';
import { HistoryDropdown } from './history-dropdown';
import { useStreamingChat } from '../../hooks/use-streaming-chat';
import { useTodo } from '../../hooks/use-todo';
import type { TodoTask } from '../../types/todo';

export function ChatContainer() {
  const { tasks, updateTodos, clearTodos } = useTodo();
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
  } = useStreamingChat(tasks);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Filter out hidden messages (tool result feedback messages)
  const visibleMessages = messages.filter(msg => !msg.hidden);

  const lastAssistantIndex = visibleMessages.reduce((lastIndex, msg, index) =>
    msg.role === 'assistant' ? index : lastIndex,
    -1
  );

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
      } else if (message.type === 'openHistory') {
        setIsHistoryOpen(true);
      } else if (message.type === 'closeHistory') {
        setIsHistoryOpen(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearChat, clearTodos]);

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
          todos={tasks}
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