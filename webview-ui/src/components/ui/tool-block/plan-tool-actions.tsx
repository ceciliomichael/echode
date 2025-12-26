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

  // In YOLO mode, we bypass the isLastMessage check to ensure reliable auto-execution
  // This handles race conditions where hidden messages might temporarily affect isLastMessage
  const handleVerifyPlan = useCallback(() => {
    // For YOLO mode, only check isAwaitingUser (not isLastMessage)
    // For non-YOLO, require full isButtonActive (isAwaitingUser && isLastMessage)
    const canExecute = mode === 'yolo' ? isAwaitingUser : isButtonActive;
    if (!canExecute) return;
    
    triggerContinuation(
      'verify_plan',
      messageId,
      toolCall.toolExecutionId || '',
      result.data,
      mode
    );
  }, [mode, isAwaitingUser, isButtonActive, triggerContinuation, messageId, toolCall.toolExecutionId, result.data]);

  const handleStartImplementation = useCallback(() => {
    // For YOLO mode, only check isAwaitingUser (not isLastMessage)
    // For non-YOLO, require full isButtonActive (isAwaitingUser && isLastMessage)
    const canExecute = mode === 'yolo' ? isAwaitingUser : isButtonActive;
    if (!canExecute) return;
    
    triggerContinuation(
      'start_implementation',
      messageId,
      toolCall.toolExecutionId || '',
      result.data,
      mode
    );
  }, [mode, isAwaitingUser, isButtonActive, triggerContinuation, messageId, toolCall.toolExecutionId, result.data]);

  // YOLO Mode: Auto-verify when plan is ready
  // Note: With ToolExecutor auto-verification for create_plan/update_plan,
  // this effect mainly serves as a fallback safety net
  useEffect(() => {
    // For YOLO, we only need isAwaitingUser (not isLastMessage)
    if (mode !== 'yolo' || !isAwaitingUser || actionType !== 'verify_plan') {
      return;
    }
    
    // Prevent duplicate triggers
    if (hasAutoTriggeredRef.current) {
      return;
    }
    
    // Mark as triggered immediately to prevent race conditions
    hasAutoTriggeredRef.current = true;
    
    const timer = setTimeout(() => {
      console.log('[PlanToolActions] YOLO auto-triggering verify_plan');
      handleVerifyPlan();
    }, 300); // Longer delay to ensure streaming finishes
    
    return () => clearTimeout(timer);
  }, [mode, isAwaitingUser, actionType, handleVerifyPlan]);

  // YOLO Mode: Auto-start implementation when ready (Handoff)
  // This is CRITICAL - it triggers the mode switch to 'agent' for implementation
  useEffect(() => {
    // For YOLO, we only need isAwaitingUser (not isLastMessage)
    if (mode !== 'yolo' || !isAwaitingUser || actionType !== 'start_implementation') {
      return;
    }
    
    // Prevent duplicate triggers
    if (hasAutoTriggeredRef.current) {
      return;
    }
    
    // Mark as triggered immediately to prevent race conditions
    hasAutoTriggeredRef.current = true;
    
    // Use longer delay to ensure streaming has completed before sending continuation
    // This prevents race condition where sendMessage blocks if streaming is still active
    const timer = setTimeout(() => {
      console.log('[PlanToolActions] YOLO auto-triggering start_implementation');
      handleStartImplementation();
    }, 300); // Longer delay to ensure streaming finishes
    
    return () => clearTimeout(timer);
  }, [mode, isAwaitingUser, actionType, handleStartImplementation]);

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