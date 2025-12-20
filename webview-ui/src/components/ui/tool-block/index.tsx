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
}

const ToolBlockComponent = ({
  toolCall,
  isStreaming = false,
  messageId = 'unknown',
}: ToolBlockProps) => {
  const isEchoSearch = toolCall.toolName === 'echo_search';

  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand when awaiting user action (e.g. Plan tool)
  // This ensures the action buttons are visible when the state changes
  useEffect(() => {
    if (toolCall.status === 'awaiting_user') {
      setTimeout(() => {
        setIsExpanded(true);
      }, 0);
    }
  }, [toolCall.status]);

  // Auto-collapse echo_search when completed or aborted
  useEffect(() => {
    if (isEchoSearch && (toolCall.status === 'completed' || toolCall.status === 'aborted')) {
      setTimeout(() => {
        setIsExpanded(false);
      }, 0);
    }
  }, [isEchoSearch, toolCall.status]);

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
  // For file-modifying tools (apply_diff, write_to_file), disable toggle while executing
  const canToggle = useMemo(() => {
    const isFileModifyingTool = toolCall.toolName === 'apply_diff' || toolCall.toolName === 'write_to_file';
    
    if (isFileModifyingTool) {
      // Only allow toggle after the tool has completed with result data
      const isCompleted = toolCall.status === 'completed' && toolCall.result != null;
      return isCompleted;
    }
    
    // All other tools can always be toggled
    return true;
  }, [toolCall.toolName, toolCall.status, toolCall.result]);

  // Check for plan tool completion with user action for the message below
  const isPlanTool = toolCall.toolName === 'plan';
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
    JSON.stringify(prevProps.toolCall.parameters) ===
    JSON.stringify(nextProps.toolCall.parameters) &&
    JSON.stringify(prevProps.toolCall.result) === JSON.stringify(nextProps.toolCall.result) &&
    prevProps.toolCall.progress?.iteration === nextProps.toolCall.progress?.iteration &&
    prevProps.toolCall.progress?.phase === nextProps.toolCall.progress?.phase &&
    prevProps.toolCall.progress?.toolsIteration === nextProps.toolCall.progress?.toolsIteration &&
    toolsEqual
  );
});
