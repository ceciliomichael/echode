import { useCallback } from 'react';
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
 * 
 * NOTE: In YOLO mode, the backend PlanTool returns awaitsUserAction=false,
 * so this component will NOT render buttons (status won't be 'awaiting_user').
 * The streaming loop handles YOLO mode automatically without UI interaction.
 */
export function PlanToolActions({ 
  toolCall, 
  messageId,
  isLastMessage = true,
  mode,
}: PlanToolActionsProps) {
  const { triggerContinuation } = usePlanContinuationEmitter();

  const result = toolCall.result;
  if (!result?.success || !result.data) {
    return null;
  }

  // Cast data to include potential userAction from continuation
  const data = result.data as PlanToolResult & { userAction?: string };
  const actionType = data.actionType;

  // Only show actions when status is awaiting_user OR when completed with a user action
  // In YOLO mode, awaitsUserAction=false from backend, so status will be 'completed'
  // and this component won't show buttons (which is the desired behavior)
  const isAwaitingUser = toolCall.status === 'awaiting_user';
  const isCompletedWithAction = toolCall.status === 'completed' && !!data.userAction;

  if (!isAwaitingUser && !isCompletedWithAction) {
    return null;
  }

  // Button is only active when awaiting user AND this is the last message
  const isButtonActive = isAwaitingUser && isLastMessage;

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
      className="flex flex-wrap items-center justify-end gap-2 pt-3 mt-3 border-t"
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