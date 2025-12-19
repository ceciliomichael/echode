import { useCallback } from 'react';
import type { Message } from '../../types/chat';
import type { ToolExecutionState } from '../../types/tool';

interface MessageActionsProps {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

/**
 * Hook for message update operations (update content, tool executions)
 */
export function useMessageActions({ setMessages }: MessageActionsProps) {
  const updateMessage = useCallback((messageId: string, newContent: string) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      )
    );
  }, [setMessages]);

  const updateToolExecution = useCallback((
    messageId: string,
    toolExecutionId: string,
    state: ToolExecutionState
  ) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          const toolExecutions = new Map(msg.toolExecutions || []);
          toolExecutions.set(toolExecutionId, state);
          return { ...msg, toolExecutions };
        }
        return msg;
      })
    );
  }, [setMessages]);

  const updateToolResultData = useCallback((
    toolName: string,
    updateFn: (data: unknown) => unknown
  ) => {
    setMessages(prevMessages => {
      const newMessages = [...prevMessages];
      const lastMessage = newMessages[newMessages.length - 1];

      if (lastMessage?.role === 'assistant' && lastMessage.toolExecutions) {
        const newToolExecutions = new Map(lastMessage.toolExecutions);

        for (const [execId, execution] of newToolExecutions.entries()) {
          if (execution.toolName === toolName && execution.result?.data) {
            const updatedExecution: ToolExecutionState = {
              ...execution,
              result: {
                ...execution.result,
                data: updateFn(execution.result.data),
              },
            };
            newToolExecutions.set(execId, updatedExecution);
          }
        }

        lastMessage.toolExecutions = newToolExecutions;
      }

      return newMessages;
    });
  }, [setMessages]);

  return {
    updateMessage,
    updateToolExecution,
    updateToolResultData,
  };
}
