import { memo, useMemo, useState, useEffect, useRef } from 'react';
import type { ToolCall } from '../../../types/tool';
import { getToolStatusDisplay } from '../../../utils/tool-status-formatter';
import { getToolFileInfo } from '../../../utils/tool-file-info';
import { ToolBlockHeader } from './tool-block-header';
import { ToolBlockContent } from './tool-block-content';

interface ToolBlockProps {
  toolCall: ToolCall;
  isStreaming?: boolean;
}

const ToolBlockComponent = ({
  toolCall,
  isStreaming = false,
}: ToolBlockProps) => {
  const isEchoSearch = toolCall.toolName === 'echo_search';
  const shouldAutoExpand = isEchoSearch;

  const [isExpanded, setIsExpanded] = useState(false);

  const hasAutoExpandedRef = useRef(false);

  // Auto-expand echo_search as soon as the tool starts running
  useEffect(() => {
    if (
      shouldAutoExpand &&
      (toolCall.status === 'pending' || toolCall.status === 'executing') &&
      !hasAutoExpandedRef.current
    ) {
      hasAutoExpandedRef.current = true;
      // Defer the state update to avoid synchronous render warning
      setTimeout(() => {
        setIsExpanded(true);
      }, 0);
    }
  }, [shouldAutoExpand, toolCall.status]);

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

  const hasResultContent = toolCall.toolName === 'echo_search'
    ? (toolCall.status === 'executing' || toolCall.status === 'pending' || toolCall.status === 'aborted' || !!toolCall.result)
    : (!!toolCall.result && toolCall.status !== 'aborted');
  const hasStreamingContent =
    toolCall.toolName === 'echo_search' ||
    (toolCall.toolName === 'write_to_file' && !!toolCall.parameters.content);

  const canToggle = hasResultContent || hasStreamingContent;

  return (
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
        hasResultContent={hasResultContent}
        canToggle={canToggle}
      />

      <ToolBlockContent
        toolCall={toolCall}
        fileInfo={fileInfo}
        isExpanded={isExpanded}
      />
    </div>
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
