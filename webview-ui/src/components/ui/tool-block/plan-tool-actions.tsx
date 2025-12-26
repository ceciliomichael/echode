import { useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Rocket } from 'lucide-react';
import type { ToolCall } from '../../../types/tool';
import type { PlanToolResult } from '../../../lib/tools/plan-tool';
import { usePlanContinuationEmitter } from '../../../hooks/use-plan-continuation';
import type { ChatMode } from '../../../types/chat-mode';

interface PlanToolActionsProps {
  toolCall: ToolCall;
  messageId: string;
  isLastMessage?: boolean;
  mode?: ChatMode;
}

/**
 * Plan Tool Actions Component
 * 
 * Renders action buttons for the plan tool based on the action type:
 * - verify_plan: "Verify Plan" button for create_plan mode
 * - start_implementation: "Start Implementation" button for handoff mode
 * 
 * Uses the plan continuation emitter to trigger continuation without
 * needing callbacks passed through the component tree.
 */
export function PlanToolActions({ 
  toolCall, 
  messageId,
  isLastMessage = true,
  mode,
}: PlanToolActionsProps) {
  const { triggerContinuation } = usePlanContinuationEmitter();
  
  // Track if we've already triggered auto-action to prevent duplicates
  const hasAutoTriggeredRef = useRef(false);
  // Track the current toolExecutionId to reset trigger state on new tools
  const lastToolExecutionIdRef = useRef<string | undefined>(undefined);

  const result = toolCall.result;
  if (!result?.success || !result.data) {
    return null;
  }

  // Cast data to include potential userAction from continuation
  const data = result.data as PlanToolResult & { userAction?: string };
  const actionType = data.actionType;

  // Only show actions when status is awaiting_user OR when completed with a user action
  const isAwaitingUser = toolCall.status === 'awaiting_user';
  const isCompletedWithAction = toolCall.status === 'completed' && !!data.userAction;

  if (!isAwaitingUser && !isCompletedWithAction) {
    return null;
  }

  // Button is only active when awaiting user AND this is the last message
  const isButtonActive = isAwaitingUser && isLastMessage;

  // Reset auto-trigger flag when toolExecutionId changes (new tool call)
  if (toolCall.toolExecutionId !== lastToolExecutionIdRef.current) {
    lastToolExecutionIdRef.current = toolCall.toolExecutionId;
    hasAutoTriggeredRef.current = false;
  }

  const handleVerifyPlan = useCallback(() => {
    if (!isButtonActive) return;
    triggerContinuation(
      'verify_plan',
      messageId,
      toolCall.toolExecutionId || '',
      result.data,
      mode
    );
  }, [isButtonActive, triggerContinuation, messageId, toolCall.toolExecutionId, result.data, mode]);

  const handleStartImplementation = useCallback(() => {
    if (!isButtonActive) return;
    triggerContinuation(
      'start_implementation',
      messageId,
      toolCall.toolExecutionId || '',
      result.data,
      mode
    );
  }, [isButtonActive, triggerContinuation, messageId, toolCall.toolExecutionId, result.data, mode]);

  // YOLO Mode: Auto-verify when plan is ready
  useEffect(() => {
    if (mode !== 'yolo' || !isButtonActive || actionType !== 'verify_plan') {
      return;
    }
    
    // Prevent duplicate triggers
    if (hasAutoTriggeredRef.current) {
      return;
    }
    
    // Mark as triggered immediately to prevent race conditions
    hasAutoTriggeredRef.current = true;
    
    const timer = setTimeout(() => {
      handleVerifyPlan();
    }, 100); // Reduced delay for faster response
    
    return () => clearTimeout(timer);
  }, [mode, isButtonActive, actionType, handleVerifyPlan]);

  // YOLO Mode: Auto-start implementation when ready
  useEffect(() => {
    if (mode !== 'yolo' || !isButtonActive || actionType !== 'start_implementation') {
      return;
    }
    
    // Prevent duplicate triggers
    if (hasAutoTriggeredRef.current) {
      return;
    }
    
    // Mark as triggered immediately to prevent race conditions
    hasAutoTriggeredRef.current = true;
    
    const timer = setTimeout(() => {
      handleStartImplementation();
    }, 100); // Reduced delay for faster response
    
    return () => clearTimeout(timer);
  }, [mode, isButtonActive, actionType, handleStartImplementation]);

  // After user clicks, show muted style
  const isClicked = isCompletedWithAction;

  const buttonStyle = isClicked
    ? {
        backgroundColor: 'rgba(249, 115, 22, 0.10)',
        color: '#f97316',
        borderColor: '#f97316',
      }
    : {
        backgroundColor: '#f97316',
        color: '#ffffff',
        borderColor: '#f97316',
      };

  return (
    <div 
      className="flex items-center justify-end gap-2 pt-3 mt-3 border-t"
      style={{ borderColor: 'var(--vscode-input-border)' }}
    >
      {actionType === 'verify_plan' && (
        <button
          onClick={handleVerifyPlan}
          disabled={!isButtonActive}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${!isButtonActive ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-90'}`}
          style={buttonStyle}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Verify Plan
        </button>
      )}

      {actionType === 'start_implementation' && (
        <button
          onClick={handleStartImplementation}
          disabled={!isButtonActive}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${!isButtonActive ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-90'}`}
          style={buttonStyle}
        >
          <Rocket className="w-3.5 h-3.5" />
          Start Implementation
        </button>
      )}
    </div>
  );
}