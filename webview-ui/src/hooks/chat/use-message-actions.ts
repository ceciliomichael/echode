import { useCallback } from 'react';
import type { Message } from '../../types/chat';
import type { ToolExecutionState } from '../../types/tool';

// Planning tool names that should be superseded when user sends a new message
const PLANNING_TOOL_NAMES = ['plan_navigator', 'plan_handoff'];

interface MessageActionsProps {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

/**
 * Hook for message update operations (update content, tool executions, supersede planning tools)
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

  const supersedePlanningTools = useCallback(() => {
    setMessages(prevMessages => {
      let hasChanges = false;

      const newMessages = prevMessages.map(msg => {
        if (msg.role !== 'assistant' || !msg.toolExecutions) {
          return msg;
        }

        const newToolExecutions = new Map(msg.toolExecutions);
        let messageChanged = false;

        for (const [execId, execution] of newToolExecutions.entries()) {
          if (!PLANNING_TOOL_NAMES.includes(execution.toolName)) {
            continue;
          }

          const data = execution.result?.data as Record<string, unknown> | undefined;

          if (data?.superseded) continue;
          if (execution.toolName === 'plan_navigator' && data?.selectedIndex !== undefined) continue;
          if (execution.toolName === 'plan_handoff' && data?.clicked) continue;

          const updatedExecution: ToolExecutionState = {
            ...execution,
            result: {
              ...execution.result,
              success: execution.result?.success ?? true,
              data: { ...data, superseded: true },
            },
          };
          newToolExecutions.set(execId, updatedExecution);
          messageChanged = true;
          hasChanges = true;
        }

        if (messageChanged) {
          return { ...msg, toolExecutions: newToolExecutions };
        }
        return msg;
      });

      return hasChanges ? newMessages : prevMessages;
    });
  }, [setMessages]);

  return {
    updateMessage,
    updateToolExecution,
    updateToolResultData,
    supersedePlanningTools,
  };
}
