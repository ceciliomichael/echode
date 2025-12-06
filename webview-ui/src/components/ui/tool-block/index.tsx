import { memo, useMemo, useState, useEffect, useRef } from 'react';
import type { ToolCall } from '../../../types/tool';
import { getToolStatusDisplay } from '../../../utils/tool-status-formatter';
import { getToolFileInfo } from '../../../utils/tool-file-info';
import { ToolBlockHeader } from './tool-block-header';
import { ToolBlockContent } from './tool-block-content';

interface ToolBlockProps {
  toolCall: ToolCall;
  isConnectedTop?: boolean;
  isConnectedBottom?: boolean;
  isStreaming?: boolean;
}

const ToolBlockComponent = ({
  toolCall,
  isConnectedTop = false,
  isConnectedBottom = false,
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

  // Auto-expand plan tools when completed
  const isPlanTool = toolCall.toolName === 'plan_handoff' || toolCall.toolName === 'plan_navigator';
  useEffect(() => {
    if (isPlanTool && toolCall.status === 'completed' && !hasAutoExpandedRef.current) {
      hasAutoExpandedRef.current = true;
      setTimeout(() => {
        setIsExpanded(true);
      }, 0);
    }
  }, [isPlanTool, toolCall.status]);

  // Get status display
  const statusConfig = useMemo(
    () => getToolStatusDisplay(toolCall, isStreaming),
    [toolCall, isStreaming]
  );

  // Get file info and icon configuration
  const fileInfo = useMemo(
    () =>
      getToolFileInfo(
        toolCall.toolName,
        toolCall.parameters,
        toolCall.status,
        isStreaming
      ),
    [toolCall, isStreaming]
  );

  const hasResultContent = !!toolCall.result && toolCall.status !== 'aborted';

  return (
    <div
      className={`overflow-hidden w-full ${isConnectedTop ? 'mt-0' : 'mt-2'}`}
      style={{
        borderColor: 'var(--vscode-input-border)',
        backgroundColor: 'var(--vscode-editor-background)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderTopWidth: isConnectedTop ? 0 : '1px',
        borderTopLeftRadius: isConnectedTop ? 0 : '0.75rem',
        borderTopRightRadius: isConnectedTop ? 0 : '0.75rem',
        borderBottomLeftRadius: isConnectedBottom ? 0 : '0.75rem',
        borderBottomRightRadius: isConnectedBottom ? 0 : '0.75rem',
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
  return (
    prevProps.toolCall.status === nextProps.toolCall.status &&
    prevProps.toolCall.toolName === nextProps.toolCall.toolName &&
    prevProps.isConnectedTop === nextProps.isConnectedTop &&
    prevProps.isConnectedBottom === nextProps.isConnectedBottom &&
    JSON.stringify(prevProps.toolCall.parameters) ===
      JSON.stringify(nextProps.toolCall.parameters) &&
    JSON.stringify(prevProps.toolCall.result) === JSON.stringify(nextProps.toolCall.result) &&
    prevProps.toolCall.progress?.iteration === nextProps.toolCall.progress?.iteration &&
    prevProps.toolCall.progress?.phase === nextProps.toolCall.progress?.phase &&
    prevProps.toolCall.progress?.tools?.length === nextProps.toolCall.progress?.tools?.length
  );
});
