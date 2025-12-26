import { useCallback, useEffect, useRef } from 'react';
import type { Message, ImageAttachment } from '../types/chat';
import type { ToolExecutionState } from '../types/tool';
import type { ChatMode } from '../types/chat-mode';

/**
 * Publish Findings Continuation Event Types
 */
export type PublishFindingsAction = 'fix_issues' | 'skip_fixes';

export interface PublishFindingsContinuationEvent {
  action: PublishFindingsAction;
  messageId: string;
  toolExecutionId: string;
  toolResult: unknown;
  mode?: ChatMode;
}

/**
 * Global event emitter for publish_findings tool continuation
 * Similar to PlanContinuationEmitter - allows the ToolBlock component to trigger
 * continuation without needing to pass callbacks through the entire component tree
 */
class PublishFindingsContinuationEmitter {
  private listeners: Set<(event: PublishFindingsContinuationEvent) => void> = new Set();

  subscribe(listener: (event: PublishFindingsContinuationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: PublishFindingsContinuationEvent): void {
    this.listeners.forEach(listener => listener(event));
  }
}

// Singleton instance
export const publishFindingsContinuationEmitter = new PublishFindingsContinuationEmitter();

/**
 * Hook for emitting publish findings continuation events from ToolBlock
 */
export function usePublishFindingsContinuationEmitter() {
  const triggerContinuation = useCallback((
    action: PublishFindingsAction,
    messageId: string,
    toolExecutionId: string,
    toolResult: unknown,
    mode?: ChatMode
  ) => {
    publishFindingsContinuationEmitter.emit({
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
 * Hook for handling publish findings continuation in the chat system
 * 
 * When a publish findings tool button is clicked:
 * 1. Updates the tool execution state from 'awaiting_user' to 'completed'
 * 2. For "Fix": switches to plan mode and sends a message to create a fix plan
 * 3. For "Skip": sends a tool result indicating user skipped the fixes
 */
export function usePublishFindingsContinuationHandler({
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
    const handleContinuation = (event: PublishFindingsContinuationEvent) => {
      const { action, messageId, toolExecutionId, toolResult } = event;

      console.log(`[PublishFindingsContinuation] Handling ${action} for message ${messageId}`);

      // Get the publish findings result data
      const findingsData = toolResult as {
        path?: string;
        reviewId?: string;
        title?: string;
        content?: string;
      } | undefined;

      // Update tool execution state to 'completed'
      const completedState: ToolExecutionState = {
        toolExecutionId,
        toolName: 'publish_findings',
        parameters: {},
        status: 'completed',
        result: {
          success: true,
          data: {
            ...findingsData,
            userAction: action,
            awaitsUserAction: false,
          },
        },
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
      updateToolExecutionRef.current(messageId, toolExecutionId, completedState);

      // Build tool result content based on action
      let toolResultData: Record<string, unknown>;

      if (action === 'fix_issues') {
        // User wants to fix the issues - switch to plan mode
        toolResultData = {
          userAction: 'fix_issues',
          message: `User wants to FIX the issues found in the code review. Switch to Plan mode and create a comprehensive plan to address all the issues identified in the review report. The review was saved at: ${findingsData?.path || 'code review report'}`,
        };

        // Switch to plan mode
        if (onModeChangeRef.current) {
          onModeChangeRef.current('plan');
        }
      } else {
        // User skipped - just notify the AI
        toolResultData = {
          userAction: 'skip_fixes',
          message: `User has reviewed the code review report and chose to SKIP fixing the issues for now. The review has been saved for future reference at: ${findingsData?.path || 'code review report'}. No further action needed.`,
        };
      }

      // Create the tool result message for AI
      const toolResultMessage = `<function_results>
<result>
<tool_name>publish_findings</tool_name>
<user_response>${JSON.stringify(toolResultData, null, 2)}</user_response>
</result>
</function_results>`;

      // Send the message with appropriate mode lock
      // For "fix_issues", lock to plan mode. For "skip", stay in current mode.
      const lockedMode = action === 'fix_issues' ? 'plan' : undefined;
      
      sendMessageRef.current(
        toolResultMessage,
        undefined, // no image attachments
        undefined, // use current messages
        true, // hidden message
        false, // no force echo search
        lockedMode
      );
    };

    const unsubscribe = publishFindingsContinuationEmitter.subscribe(handleContinuation);
    return unsubscribe;
  }, []);
}