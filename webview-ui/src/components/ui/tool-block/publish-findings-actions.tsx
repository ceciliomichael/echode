import { Wrench, SkipForward } from 'lucide-react';
import type { ToolCall } from '../../../types/tool';
import { usePublishFindingsContinuationEmitter } from '../../../hooks/use-publish-findings-continuation';
import type { ChatMode } from '../../../types/chat-mode';

interface PublishFindingsActionsProps {
  toolCall: ToolCall;
  messageId: string;
  isLastMessage?: boolean;
  mode?: ChatMode;
}

/**
 * Publish Findings Actions Component
 * 
 * Renders action buttons for the publish_findings tool:
 * - "Fix Issues": Switch to Plan mode and create a plan to fix the review findings
 * - "Skip": Acknowledge the review and continue without fixing
 * 
 * Uses the publish findings continuation emitter to trigger continuation
 * without needing callbacks passed through the component tree.
 */
export function PublishFindingsActions({ 
  toolCall, 
  messageId,
  isLastMessage = true,
  mode,
}: PublishFindingsActionsProps) {
  const { triggerContinuation } = usePublishFindingsContinuationEmitter();

  const result = toolCall.result;
  if (!result?.success || !result.data) {
    return null;
  }

  // Cast data to include potential userAction from continuation
  const data = result.data as { userAction?: string; path?: string };

  // Check if user already took an action
  const hasUserAction = !!data.userAction;

  // Check if tool is awaiting user interaction or completed with user action
  const isAwaitingUser = toolCall.status === 'awaiting_user';
  const isCompletedWithAction = toolCall.status === 'completed' && hasUserAction;

  // Don't show if user already took an action (and tool is completed)
  if (isCompletedWithAction) {
    return null;
  }

  // Only show buttons when awaiting user action
  if (!isAwaitingUser && !hasUserAction) {
    // For completed status without awaiting_user, don't show buttons
    // (This handles legacy behavior where tool completed without awaitsUserAction)
    if (toolCall.status === 'completed') {
      return null;
    }
  }

  // Button is only active when awaiting user AND this is the last message
  const isButtonActive = isAwaitingUser && isLastMessage;

  const handleFixIssues = () => {
    if (!isButtonActive) return;
    triggerContinuation(
      'fix_issues',
      messageId,
      toolCall.toolExecutionId || '',
      result.data,
      mode
    );
  };

  const handleSkip = () => {
    if (!isButtonActive) return;
    triggerContinuation(
      'skip_fixes',
      messageId,
      toolCall.toolExecutionId || '',
      result.data,
      mode
    );
  };

  return (
    <div 
      className="flex items-center justify-end gap-2 pt-3 mt-3 border-t"
      style={{ borderColor: 'var(--vscode-input-border)' }}
    >
      <button
        onClick={handleSkip}
        disabled={!isButtonActive}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${!isButtonActive ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-90'}`}
        style={{
          backgroundColor: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
          borderColor: 'var(--vscode-input-border)',
        }}
      >
        <SkipForward className="w-3.5 h-3.5" />
        Skip
      </button>

      <button
        onClick={handleFixIssues}
        disabled={!isButtonActive}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${!isButtonActive ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-90'}`}
        style={{
          backgroundColor: '#ef4444',
          color: '#ffffff',
          borderColor: '#ef4444',
        }}
      >
        <Wrench className="w-3.5 h-3.5" />
        Fix Issues
      </button>
    </div>
  );
}