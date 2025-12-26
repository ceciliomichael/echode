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
 * Interface for plan data extracted from tool results
 */
interface PlanData {
  planFilePath?: string;
  planContent?: string;
  planTitle?: string;
}

/**
 * Find the latest plan (create_plan or update_plan) from conversation messages.
 * Scans messages in reverse order to find the most recent plan tool result.
 * This ensures session-scoped tracking - only plans from this conversation are considered.
 */
function findLatestPlanFromMessages(messages: Message[]): PlanData | undefined {
  // Scan messages in reverse order (newest first)
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant' || !message.toolExecutions) {
      continue;
    }

    // toolExecutions is a Map<string, ToolExecutionState>
    // Convert to array and check each execution
    const toolExecArray = Array.from(message.toolExecutions.values());
    
    // Check tool executions in reverse order within the message
    for (let j = toolExecArray.length - 1; j >= 0; j--) {
      const toolExec = toolExecArray[j];
      if (toolExec.toolName !== 'plan') {
        continue;
      }

      const result = toolExec.result;
      if (!result?.success || !result.data) {
        continue;
      }

      const data = result.data as {
        mode?: string;
        planFilePath?: string;
        planContent?: string;
        planTitle?: string;
      };

      // Only consider create_plan or update_plan modes (not handoff)
      if (data.mode === 'create_plan' || data.mode === 'update_plan') {
        if (data.planFilePath || data.planContent) {
          return {
            planFilePath: data.planFilePath,
            planContent: data.planContent,
            planTitle: data.planTitle,
          };
        }
      }
    }
  }

  return undefined;
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
  messages,
  setMessages,
  updateToolExecution,
  sendMessage,
  onModeChange,
}: {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  updateToolExecution: (messageId: string, toolExecutionId: string, state: ToolExecutionState) => void;
  sendMessage: (content: string, attachments?: ImageAttachment[], overrideMessages?: Message[], isHidden?: boolean, forceEchoSearch?: boolean, lockedMode?: ChatMode) => Promise<void>;
  onModeChange?: (mode: ChatMode) => void;
}) {
  const messagesRef = useRef(messages);
  const sendMessageRef = useRef(sendMessage);
  const setMessagesRef = useRef(setMessages);
  const updateToolExecutionRef = useRef(updateToolExecution);
  const onModeChangeRef = useRef(onModeChange);

  // Keep refs up to date
  useEffect(() => {
    messagesRef.current = messages;
    sendMessageRef.current = sendMessage;
    setMessagesRef.current = setMessages;
    updateToolExecutionRef.current = updateToolExecution;
    onModeChangeRef.current = onModeChange;
  }, [messages, sendMessage, setMessages, updateToolExecution, onModeChange]);

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
        planContent?: string;
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
        
        // Find the latest plan from conversation messages (session-scoped)
        // The handoff tool result doesn't contain plan details - we need to look them up
        const latestPlan = findLatestPlanFromMessages(messagesRef.current);
        const planContent = latestPlan?.planContent;
        const planFilePath = latestPlan?.planFilePath;

        toolResultData = {
          userAction: 'start_implementation',
          approved: true,
          summary,
          planContent,
          planFilePath,
          message: 'User approved the plan. Begin implementation.',
        };
        
        // Switch to agent mode for handoff (unless in YOLO mode)
        if (onModeChangeRef.current && mode !== 'yolo') {
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

      // Determine the mode for the next message (lockedMode for prompt/tools selection)
      // YOLO mode: UI stays 'yolo' but internally uses 'agent' prompt after handoff
      // - start_implementation: use 'agent' prompt (even for YOLO - this is the internal switch)
      // - verify_plan: use 'plan' prompt (YOLO stays in plan phase until handoff)
      const nextMode = action === 'start_implementation' 
        ? 'agent'  // Always use agent prompt after handoff (YOLO or not)
        : (action === 'verify_plan' ? (mode === 'yolo' ? 'yolo' : 'plan') : mode);

      // Send as a hidden message (user won't see it, but AI receives it as tool result)
      // Use a small delay to ensure state updates are processed
      setTimeout(() => {
        sendMessageRef.current(messageContent, undefined, undefined, true, false, nextMode); // isHidden = true, forceEchoSearch = false, lockedMode = nextMode
      }, 100);
    };

    const unsubscribe = planContinuationEmitter.subscribe(handleContinuation);
    return unsubscribe;
  }, []);
}