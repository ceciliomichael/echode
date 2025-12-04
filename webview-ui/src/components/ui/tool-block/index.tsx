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

  const [isExpanded, setIsExpanded] = useState(false);

  const hasAutoExpandedRef = useRef(false);

  // Auto-expand echo_search when it reaches the first iteration
  useEffect(() => {
    if (isEchoSearch && toolCall.status === 'executing' && toolCall.progress?.iteration === 1 && !hasAutoExpandedRef.current) {
      hasAutoExpandedRef.current = true;
      // Defer the state update to avoid synchronous render warning
      setTimeout(() => {
        setIsExpanded(true);
      }, 0);
    }
  }, [isEchoSearch, toolCall.status, toolCall.progress?.iteration]);

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
