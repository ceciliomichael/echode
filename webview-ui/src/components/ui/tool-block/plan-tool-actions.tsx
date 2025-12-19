import { CheckCircle, Rocket } from 'lucide-react';
import type { ToolCall } from '../../../types/tool';
import type { PlanToolResult } from '../../../lib/tools/plan-tool';
import { usePlanContinuationEmitter } from '../../../hooks/use-plan-continuation';

interface PlanToolActionsProps {
  toolCall: ToolCall;
  messageId: string;
}

/**
 * Plan Tool Actions Component
 * 
 * Renders action buttons for the plan tool based on the action type:
 * - verify_plan: "Verify Plan" button for create_plan mode
 * - start_implementation: "Start Implementation" button for handoff mode
 * - none: No button (for ask mode)
 * 
 * Uses the plan continuation emitter to trigger continuation without
 * needing callbacks passed through the component tree.
 */
export function PlanToolActions({ 
  toolCall, 
  messageId,
}: PlanToolActionsProps) {
  const { triggerContinuation } = usePlanContinuationEmitter();

  const result = toolCall.result;
  if (!result?.success || !result.data) {
    return null;
  }

  // Cast data to include potential userAction from continuation
  const data = result.data as PlanToolResult & { userAction?: string };
  const actionType = data.actionType;

  // No button for 'ask' mode (actionType: 'none')
  if (actionType === 'none') {
    return null;
  }

  // Only show actions when status is awaiting_user OR when completed with a user action
  const isAwaitingUser = toolCall.status === 'awaiting_user';
  const isCompletedWithAction = toolCall.status === 'completed' && !!data.userAction;

  if (!isAwaitingUser && !isCompletedWithAction) {
    return null;
  }

  const handleVerifyPlan = () => {
    if (!isAwaitingUser) return;
    triggerContinuation(
      'verify_plan',
      messageId,
      toolCall.toolExecutionId || '',
      result.data
    );
  };

  const handleStartImplementation = () => {
    if (!isAwaitingUser) return;
    triggerContinuation(
      'start_implementation',
      messageId,
      toolCall.toolExecutionId || '',
      result.data
    );
  };

  return (
    <div 
      className="flex items-center gap-2 pt-3 mt-3 border-t"
      style={{ borderColor: 'var(--vscode-input-border)' }}
    >
      {actionType === 'verify_plan' && (
        <button
          onClick={handleVerifyPlan}
          disabled={!isAwaitingUser}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${!isAwaitingUser ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
          }}
          onMouseEnter={(e) => {
            if (isAwaitingUser) e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
          }}
          onMouseLeave={(e) => {
            if (isAwaitingUser) e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
          }}
        >
          <CheckCircle className="w-4 h-4" />
          Verify Plan
        </button>
      )}

      {actionType === 'start_implementation' && (
        <button
          onClick={handleStartImplementation}
          disabled={!isAwaitingUser}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${!isAwaitingUser ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{
            backgroundColor: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
          }}
          onMouseEnter={(e) => {
            if (isAwaitingUser) e.currentTarget.style.backgroundColor = 'var(--vscode-button-hoverBackground)';
          }}
          onMouseLeave={(e) => {
            if (isAwaitingUser) e.currentTarget.style.backgroundColor = 'var(--vscode-button-background)';
          }}
        >
          <Rocket className="w-4 h-4" />
          Start Implementation
        </button>
      )}
    </div>
  );
}