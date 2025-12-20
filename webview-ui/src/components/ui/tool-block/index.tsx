import { memo, useMemo, useState, useEffect } from 'react';
import type { ToolCall } from '../../../types/tool';
import { getToolStatusDisplay } from '../../../utils/tool-status-formatter';
import { getToolFileInfo } from '../../../utils/tool-file-info';
import { ToolBlockHeader } from './tool-block-header';
import { ToolBlockContent } from './tool-block-content';

interface ToolBlockProps {
  toolCall: ToolCall;
  isStreaming?: boolean;
  messageId?: string;
  isLastMessage?: boolean;
}

const ToolBlockComponent = ({
  toolCall,
  isStreaming = false,
  messageId = 'unknown',
  isLastMessage = true,
}: ToolBlockProps) => {
  const isEchoSearch = toolCall.toolName === 'echo_search';
  const isPlanTool = toolCall.toolName === 'plan';

  // echo_search starts expanded by default to show progress
  const [isExpanded, setIsExpanded] = useState(isEchoSearch);

  // Auto-expand when awaiting user action (e.g. Plan tool) - only for the last message
  // This ensures the action buttons are visible when the state changes
  useEffect(() => {
    if (toolCall.status === 'awaiting_user' && isLastMessage) {
      setTimeout(() => {
        setIsExpanded(true);
      }, 0);
    }
  }, [toolCall.status, isLastMessage]);

  // Auto-collapse echo_search when completed or aborted
  useEffect(() => {
    if (isEchoSearch && (toolCall.status === 'completed' || toolCall.status === 'aborted')) {
      setTimeout(() => {
        setIsExpanded(false);
      }, 0);
    }
  }, [isEchoSearch, toolCall.status]);

  // Auto-collapse plan tool when:
  // 1. User clicked a button (status becomes 'completed' with userAction)
  // 2. This is no longer the last message (user sent a new message/reply)
  useEffect(() => {
    if (!isPlanTool) return;
    
    const planResult = toolCall.result?.data as { userAction?: string } | undefined;
    const hasUserAction = !!planResult?.userAction;
    
    // User clicked an action button (Verify Plan or Start Implementation)
    if (hasUserAction) {
      setIsExpanded(false);
      return;
    }
    
    // This is no longer the last message (user sent a new message/reply)
    // This handles all modes: ask, create_plan, update_plan, handoff
    if (!isLastMessage) {
      setIsExpanded(false);
    }
  }, [isPlanTool, toolCall.result, isLastMessage]);

  // Get status display
  const statusConfig = useMemo(
    () => getToolStatusDisplay(toolCall, isStreaming),
    [toolCall, isStreaming]
  );

  // Determine whether the icon should appear in an executing/spinning state
  const isIconExecuting = useMemo(() => {
    // If the tool has completed with results, it's NOT executing anymore
    if (toolCall.status === 'completed' && toolCall.result) {
      // For write_to_file and apply_diff, keep spinning only if we don't have diff data yet
      const isWriteOrApply = toolCall.toolName === 'write_to_file' || toolCall.toolName === 'apply_diff';
      const hasResultData = toolCall.result.success && toolCall.result.data != null;

      if (isWriteOrApply && !hasResultData) {
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
    const isFileModifyingTool = toolCall.toolName === 'apply_diff' || toolCall.toolName === 'write_to_file';
    if (isFileModifyingTool) {
      const isCompleted = toolCall.status === 'completed' && toolCall.result != null;
      return isCompleted;
    }
    
    // All other tools can be toggled once not executing
    return true;
  }, [toolCall.toolName, toolCall.status, toolCall.result]);

  // Check for plan tool completion with user action for the message below
  const planResult = isPlanTool ? toolCall.result?.data as { userAction?: string } | undefined : undefined;
  const userAction = planResult?.userAction;

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
        />

        <ToolBlockContent
          toolCall={toolCall}
          fileInfo={fileInfo}
          isExpanded={isExpanded}
          messageId={messageId}
          isLastMessage={isLastMessage}
        />
      </div>

      {isPlanTool && userAction && (
        <div 
          className="mt-4 mb-2 flex items-center justify-center gap-3 select-none w-full"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          <div className="h-[1px] flex-1" style={{ backgroundColor: 'currentColor', opacity: 0.2 }} />
          <span className="text-xs font-medium uppercase tracking-widest opacity-80 flex-shrink-0">
            {userAction === 'verify_plan' ? 'Plan Verified' : 
             userAction === 'start_implementation' ? 'Implementation Started' : ''}
          </span>
          <div className="h-[1px] flex-1" style={{ backgroundColor: 'currentColor', opacity: 0.2 }} />
        </div>
      )}
    </>
  );
};

export const ToolBlock = memo(ToolBlockComponent, (prevProps, nextProps) => {
  // Compare tools arrays by content, not just length
  const prevTools = prevProps.toolCall.progress?.tools || [];
  const nextTools = nextProps.toolCall.progress?.tools || [];
  const toolsEqual = prevTools.length === nextTools.length &&
    prevTools.every((tool, i) => tool === nextTools[i]);

  return (
    prevProps.toolCall.status === nextProps.toolCall.status &&
    prevProps.toolCall.toolName === nextProps.toolCall.toolName &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isLastMessage === nextProps.isLastMessage &&
    JSON.stringify(prevProps.toolCall.parameters) ===
    JSON.stringify(nextProps.toolCall.parameters) &&
    JSON.stringify(prevProps.toolCall.result) === JSON.stringify(nextProps.toolCall.result) &&
    prevProps.toolCall.progress?.iteration === nextProps.toolCall.progress?.iteration &&
    prevProps.toolCall.progress?.phase === nextProps.toolCall.progress?.phase &&
    prevProps.toolCall.progress?.toolsIteration === nextProps.toolCall.progress?.toolsIteration &&
    toolsEqual
  );
});
