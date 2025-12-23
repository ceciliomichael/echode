import { useCallback, useEffect, useRef } from 'react';
import type { Message, ImageAttachment } from '../types/chat';
import type { ToolExecutionState } from '../types/tool';
import type { ChatMode } from '../types/chat-mode';

/**
 * Plan Continuation Event Types
 */
export type PlanContinuationAction = 'verify_plan' | 'start_implementation';

export interface PlanContinuationEvent {
  action: PlanContinuationAction;
  messageId: string;
  toolExecutionId: string;
  toolResult: unknown;
  mode?: ChatMode;
}

/**
 * Global event emitter for plan tool continuation
 * This allows the ToolBlock component to trigger continuation
 * without needing to pass callbacks through the entire component tree
 */
class PlanContinuationEmitter {
  private listeners: Set<(event: PlanContinuationEvent) => void> = new Set();

  subscribe(listener: (event: PlanContinuationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: PlanContinuationEvent): void {
    this.listeners.forEach(listener => listener(event));
  }
}

// Singleton instance
export const planContinuationEmitter = new PlanContinuationEmitter();

/**
 * Hook for emitting plan continuation events from ToolBlock
 */
export function usePlanContinuationEmitter() {
  const triggerContinuation = useCallback((
    action: PlanContinuationAction,
    messageId: string,
    toolExecutionId: string,
    toolResult: unknown,
    mode?: ChatMode
  ) => {
    planContinuationEmitter.emit({
      action,
      messageId,
      toolExecutionId,
      toolResult,
      mode,
    });
  }, []);

  return { triggerContinuation };
}

/**
 * Hook for handling plan continuation in the chat system
 * 
 * When a plan tool button is clicked:
 * 1. Updates the tool execution state from 'awaiting_user' to 'completed'
 * 2. Sends a user message with the verification/approval
 * 3. For handoff: Also triggers mode change to 'agent'
 */
export function usePlanContinuationHandler({
  setMessages,
  updateToolExecution,
  sendMessage,
  onModeChange,
}: {
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void;
  sendMessage: (content: string, attachments?: ImageAttachment[], overrideMessages?: Message[], isHidden?: boolean, forceEchoSearch?: boolean, lockedMode?: ChatMode) => Promise<void>;
  onModeChange?: (mode: ChatMode) => void;
}) {
  const sendMessageRef = useRef(sendMessage);
  const setMessagesRef = useRef(setMessages);
  const updateToolExecutionRef = useRef(updateToolExecution);
  const onModeChangeRef = useRef(onModeChange);

  // Keep refs up to date
  useEffect(() => {
    sendMessageRef.current = sendMessage;
    setMessagesRef.current = setMessages;
    updateToolExecutionRef.current = updateToolExecution;
    onModeChangeRef.current = onModeChange;
  }, [sendMessage, setMessages, updateToolExecution, onModeChange]);

  useEffect(() => {
    const handleContinuation = (event: PlanContinuationEvent) => {
      const { action, messageId, toolExecutionId, toolResult, mode } = event;

      console.log(`[PlanContinuation] Handling ${action} for message ${messageId} (mode: ${mode})`);

      // Get the plan result data
      const planData = toolResult as {
        mode?: string;
        planTitle?: string;
        summary?: string;
        planFilePath?: string;
      } | undefined;

      // Update tool execution state to 'completed'
      const completedState: ToolExecutionState = {
        toolExecutionId,
        toolName: 'plan',
        parameters: {},
        status: 'completed',
        result: {
          success: true,
          data: {
            ...planData,
            userAction: action,
            awaitsUserAction: false, // Clear the flag
          },
        },
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
      updateToolExecutionRef.current(messageId, toolExecutionId, completedState);

      // Build tool result content (same format as normal tool execution)
      let toolResultData: Record<string, unknown>;

      if (action === 'verify_plan') {
        const planTitle = planData?.planTitle || 'the plan';
        toolResultData = {
          userAction: 'verify_plan',
          verified: true,
          planTitle,
          message: `User verified and approved "${planTitle}". Proceed with the next step.`,
        };
      } else if (action === 'start_implementation') {
        const summary = planData?.summary || 'the planned implementation';
        toolResultData = {
          userAction: 'start_implementation',
          approved: true,
          summary,
          message: 'User approved starting implementation. Switch to Agent mode and begin development.',
        };
        
        // Switch to agent mode for handoff
        if (onModeChangeRef.current) {
          console.log('[PlanContinuation] Switching to agent mode for handoff');
          onModeChangeRef.current('agent');
        }
      } else {
        toolResultData = {
          userAction: 'continue',
          message: 'User requested to continue with the next step.',
        };
      }

      // Format as tool result (same format the AI receives from normal tool execution)
      const toolResultContent = `Tool: plan\nResult: ${JSON.stringify(toolResultData, null, 2)}`;
      
      // Wrap in <tool_result> tags so the AI recognizes it as a tool result continuation
      const messageContent = `<tool_result>\n${toolResultContent}\n</tool_result>`;

      // Send as a hidden message (user won't see it, but AI receives it as tool result)
      // Use a small delay to ensure state updates are processed
      setTimeout(() => {
        sendMessageRef.current(messageContent, undefined, undefined, true, false, mode); // isHidden = true, forceEchoSearch = false, lockedMode = mode
      }, 100);
    };

    const unsubscribe = planContinuationEmitter.subscribe(handleContinuation);
    return unsubscribe;
  }, []);
}