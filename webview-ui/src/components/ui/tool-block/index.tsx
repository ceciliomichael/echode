import { memo, useMemo, useState, useEffect } from 'react';
import type { ToolCall, EchoSearchProgress } from '../../../types/tool';
import { getToolStatusDisplay } from '../../../utils/tool-status-formatter';
import { getToolFileInfo } from '../../../utils/tool-file-info';
import { ToolBlockHeader } from './tool-block-header';
import { ToolBlockContent } from './tool-block-content';
import type { ChatMode } from '../../../types/chat-mode';
import { useWorkspaceContext } from '../../../hooks/use-workspace-context';

interface ToolBlockProps {
  toolCall: ToolCall;
  isStreaming?: boolean;
  messageId?: string;
  isLastMessage?: boolean;
  mode?: ChatMode;
}

const ToolBlockComponent = ({
  toolCall,
  isStreaming = false,
  messageId = 'unknown',
  isLastMessage = true,
  mode,
}: ToolBlockProps) => {
  const workspace = useWorkspaceContext();
  const isEchoSearch = toolCall.toolName === 'echo_search';
  const isRunTerminal = toolCall.toolName === 'run_terminal';
  const isPlanTool = toolCall.toolName === 'plan';
  const isPublishFindingsTool = toolCall.toolName === 'publish_findings';

  // Check if this tool has an error (either error status or failed result)
  const hasError = toolCall.status === 'error' || toolCall.result?.success === false;

  // echo_search and run_terminal start expanded by default to show progress
  // BUT keep collapsed if there's an error or already completed (history load)
  const [isExpanded, setIsExpanded] = useState(
    (isEchoSearch || isRunTerminal) && !hasError && toolCall.status !== 'completed'
  );

  // Auto-expand when awaiting user action (e.g. Plan tool) - only for the last message
  // This ensures the action buttons are visible when the state changes
  // Don't auto-expand if there's an error
  useEffect(() => {
    if (toolCall.status === 'awaiting_user' && isLastMessage && !hasError) {
      setTimeout(() => {
        setIsExpanded(true);
      }, 0);
    }
  }, [toolCall.status, isLastMessage, hasError]);

  // Auto-collapse echo_search when completed or aborted
  useEffect(() => {
    if (isEchoSearch && (toolCall.status === 'completed' || toolCall.status === 'aborted')) {
      setTimeout(() => {
        setIsExpanded(false);
      }, 0);
    }
  }, [isEchoSearch, toolCall.status]);

  // Auto-collapse run_terminal when completed successfully
  useEffect(() => {
    if (isRunTerminal && toolCall.status === 'completed' && !hasError) {
      setTimeout(() => {
        setIsExpanded(false);
      }, 500);
    }
  }, [isRunTerminal, toolCall.status, hasError]);

  // Auto-collapse plan tool when:
  // 1. User clicked a button (status becomes 'completed' with userAction)
  // 2. This is no longer the last message (user sent a new message/reply)
  useEffect(() => {
    if (!isPlanTool) return;
    
    const planResult = toolCall.result?.data as { userAction?: string } | undefined;
    const hasUserAction = !!planResult?.userAction;
    
    // User clicked an action button (Verify Plan or Start Implementation)
    if (hasUserAction) {
      setTimeout(() => {
        setIsExpanded(false);
      }, 0);
      return;
    }
    
    // This is no longer the last message (user sent a new message/reply)
    // This handles all modes: ask, create_plan, update_plan, handoff
    if (!isLastMessage) {
      setTimeout(() => {
        setIsExpanded(false);
      }, 0);
    }
  }, [isPlanTool, toolCall.result, isLastMessage]);

  // Auto-collapse publish_findings tool when:
  // 1. User clicked a button (Fix Issues or Skip)
  // 2. This is no longer the last message
  useEffect(() => {
    if (!isPublishFindingsTool) return;
    
    const findingsResult = toolCall.result?.data as { userAction?: string } | undefined;
    const hasUserAction = !!findingsResult?.userAction;
    
    // User clicked an action button (Fix Issues or Skip)
    if (hasUserAction) {
      setTimeout(() => {
        setIsExpanded(false);
      }, 0);
      return;
    }
    
    // This is no longer the last message
    if (!isLastMessage) {
      setTimeout(() => {
        setIsExpanded(false);
      }, 0);
    }
  }, [isPublishFindingsTool, toolCall.result, isLastMessage]);

  // Get status display
  const statusConfig = useMemo(
    () => getToolStatusDisplay(toolCall, isStreaming),
    [toolCall, isStreaming]
  );

  // Determine whether the icon should appear in an executing/spinning state
  const isIconExecuting = useMemo(() => {
    // If the tool has completed with results, it's NOT executing anymore
    if (toolCall.status === 'completed' && toolCall.result) {
      // For write_to_file and edit, keep spinning only if we don't have result data yet
      const isWriteOrEdit = toolCall.toolName === 'write_to_file' || toolCall.toolName === 'edit';
      const hasResultData = toolCall.result.success && toolCall.result.data != null;

      if (isWriteOrEdit && !hasResultData) {
        return true; // Still waiting for diff data
      }
      return false; // Tool completed with results, stop spinning
    }

    // Tool is still pending/executing or streaming hasn't completed this tool yet
    return isStreaming || toolCall.status === 'pending' || toolCall.status === 'executing';
  }, [toolCall, isStreaming]);

  // Get file info and icon configuration
  const fileInfo = useMemo(
    () =>
      getToolFileInfo(
        toolCall.toolName,
        toolCall.parameters,
        toolCall.status,
        isIconExecuting
      ),
    [toolCall, isIconExecuting]
  );

  // Determine if toggling is allowed
  // Disable toggle for all tools while executing - only allow after completion
  const canToggle = useMemo(() => {
    const isExecuting = toolCall.status === 'pending' || toolCall.status === 'executing';
    
    // Don't allow toggling while tool is executing
    if (isExecuting) {
      return false;
    }
    
    // For file-modifying tools, also require result data
    const isFileModifyingTool = toolCall.toolName === 'edit' || toolCall.toolName === 'write_to_file';
    if (isFileModifyingTool) {
      const isCompleted = toolCall.status === 'completed' && toolCall.result != null;
      return isCompleted;
    }
    
    // All other tools can be toggled once not executing
    return true;
  }, [toolCall.toolName, toolCall.status, toolCall.result]);

  // Check for plan tool completion with user action for the message below
  const planResult = isPlanTool ? toolCall.result?.data as { userAction?: string } | undefined : undefined;
  const planUserAction = planResult?.userAction;

  // Check for publish_findings tool completion with user action
  const findingsResult = isPublishFindingsTool ? toolCall.result?.data as { userAction?: string } | undefined : undefined;
  const findingsUserAction = findingsResult?.userAction;

  return (
    <>
      <div
        className="overflow-hidden w-full mt-2"
        style={{
          borderColor: 'var(--vscode-input-border)',
          backgroundColor: 'var(--vscode-editor-background)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderRadius: '0.75rem',
        }}
      >
        <ToolBlockHeader
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          fileInfo={fileInfo}
          statusConfig={statusConfig}
          status={toolCall.status}
          isStreaming={isStreaming}
          canToggle={canToggle}
          toolName={toolCall.toolName}
          workspace={workspace}
        />

        <ToolBlockContent
          toolCall={toolCall}
          fileInfo={fileInfo}
          isExpanded={isExpanded}
          messageId={messageId}
          isLastMessage={isLastMessage}
          mode={mode}
          workspace={workspace}
        />
      </div>

      {isPlanTool && planUserAction && (
        <div 
          className="mt-4 mb-2 flex items-center justify-center gap-3 select-none w-full"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          <div className="h-[1px] flex-1" style={{ backgroundColor: 'currentColor', opacity: 0.2 }} />
          <span className="text-xs font-medium uppercase tracking-widest opacity-80 flex-shrink-0">
            {planUserAction === 'verify_plan' ? 'Plan Verified' : 
             planUserAction === 'start_implementation' ? 'Implementation Started' : ''}
          </span>
          <div className="h-[1px] flex-1" style={{ backgroundColor: 'currentColor', opacity: 0.2 }} />
        </div>
      )}

      {isPublishFindingsTool && findingsUserAction && (
        <div 
          className="mt-4 mb-2 flex items-center justify-center gap-3 select-none w-full"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          <div className="h-[1px] flex-1" style={{ backgroundColor: 'currentColor', opacity: 0.2 }} />
          <span className="text-xs font-medium uppercase tracking-widest opacity-80 flex-shrink-0">
            {findingsUserAction === 'fix_issues' ? 'Fixes Planned' : 
             findingsUserAction === 'skip_fixes' ? 'Review Skipped' : ''}
          </span>
          <div className="h-[1px] flex-1" style={{ backgroundColor: 'currentColor', opacity: 0.2 }} />
        </div>
      )}
    </>
  );
};

export const ToolBlock = memo(ToolBlockComponent, (prevProps, nextProps) => {
  // Check basic props equality
  if (
    prevProps.toolCall.status !== nextProps.toolCall.status ||
    prevProps.toolCall.toolName !== nextProps.toolCall.toolName ||
    prevProps.isStreaming !== nextProps.isStreaming ||
    prevProps.isLastMessage !== nextProps.isLastMessage ||
    prevProps.mode !== nextProps.mode ||
    JSON.stringify(prevProps.toolCall.parameters) !== JSON.stringify(nextProps.toolCall.parameters) ||
    JSON.stringify(prevProps.toolCall.result) !== JSON.stringify(nextProps.toolCall.result)
  ) {
    return false;
  }

  // Check progress equality
  const prevProgress = prevProps.toolCall.progress;
  const nextProgress = nextProps.toolCall.progress;

  if (prevProgress === nextProgress) {
    return true;
  }

  // Handle string progress (run_terminal)
  if (typeof prevProgress === 'string' && typeof nextProgress === 'string') {
    return prevProgress === nextProgress;
  }

  // Handle object progress (echo_search)
  if (
    typeof prevProgress === 'object' && 
    typeof nextProgress === 'object' && 
    prevProgress !== null && 
    nextProgress !== null &&
    !Array.isArray(prevProgress) && // Ensure it's not an array (though unlikely given type)
    !Array.isArray(nextProgress)
  ) {
    const p1 = prevProgress as EchoSearchProgress;
    const p2 = nextProgress as EchoSearchProgress;

    const prevTools = p1.tools || [];
    const nextTools = p2.tools || [];
    
    const toolsEqual = prevTools.length === nextTools.length &&
      prevTools.every((tool, i) => tool === nextTools[i]);

    return (
      p1.iteration === p2.iteration &&
      p1.phase === p2.phase &&
      p1.toolsIteration === p2.toolsIteration &&
      p1.message === p2.message &&
      toolsEqual
    );
  }

  return false;
});
