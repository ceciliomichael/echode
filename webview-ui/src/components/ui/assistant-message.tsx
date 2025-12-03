import { memo, useMemo } from 'react';
import { LoadingDots } from './loading-dots';
import { ThinkBlock } from './think-block';
import { ToolBlock } from './tool-block';
import { MermaidBlock } from './mermaid-block';
import { StableMarkdown } from './stable-markdown';
import { tokenizeContent } from '../../utils/content-tokenizer';
import type { ToolCall, ToolExecutionState } from '../../types/tool';

interface AssistantMessageProps {
  content: string;
  messageId?: string;
  isStreaming?: boolean;
  toolExecutions?: Map<string, ToolExecutionState>;
}

function sanitizeAssistantText(content: string): string {
  if (!content) {
    return content;
  }

  let sanitized = content;

  // Remove internal section blocks entirely from user-visible text
  const internalBlockTags = [
    'function_calls',
    'tool_calling',
    'tool_format',
    'tool_format_critical',
    'available_tools',
    'file_operations',
    'system_reminder',
  ];

  for (const tag of internalBlockTags) {
    const blockRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'g');
    sanitized = sanitized.replace(blockRegex, '');
  }

  // Remove any stray invoke/parameter blocks that might leak into text
  sanitized = sanitized.replace(/<invoke[^>]*>[\s\S]*?<\/invoke>/g, '');
  sanitized = sanitized.replace(/<parameter[^>]*>[\s\S]*?<\/parameter>/g, '');

  return sanitized;
}

function AssistantMessageComponent({ content, messageId = 'unknown', isStreaming = false, toolExecutions }: AssistantMessageProps) {
  // Tokenize content into stable segments
  const tokens = useMemo(() => tokenizeContent(content, messageId), [content, messageId]);

  // Filter out empty text tokens and incomplete tool blocks
  const visibleTokens = useMemo(() => {
    return tokens.filter(token => {
      // Filter empty text
      if (token.type === 'text' && token.content.trim() === '') {
        return false;
      }
      // For file modification tools, show as soon as path parameter is present (even if not fully closed)
      if (token.type === 'tool') {
        const isFileModificationTool = token.toolName === 'write_to_file' || token.toolName === 'apply_diff';
        if (isFileModificationTool) {
          const path = token.parameters.path as string | undefined;
          // Show if path is present and not empty, even if tool block is not fully closed
          if (path && path.trim() !== '') {
            return true;
          }
          // Hide if path is missing or empty
          return false;
        }
        
        // For planning tools (plan_navigator, plan_handoff, todo_write), show even if not fully closed
        // This ensures they appear immediately and can be visually connected to adjacent tools
        const isPlanningTool = token.toolName === 'plan_navigator' || token.toolName === 'plan_handoff' || token.toolName === 'todo_write';
        if (isPlanningTool && !token.isClosed) {
          // Show planning tools as soon as tool_name is present
          return true;
        }
      }
      // Filter incomplete tool blocks for non-file-modification and non-planning tools
      if (token.type === 'tool' && !token.isClosed) {
        return false;
      }
      return true;
    });
  }, [tokens]);

  if (!content) {
    // Show loading dots when message is empty and pipeline is active
    // This includes: AI streaming OR tool executing (waiting for AI response)
    if (isStreaming) {
      return (
        <div style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
          <div className="max-w-none">
            <LoadingDots />
          </div>
        </div>
      );
    }
    // Don't render anything if no content and pipeline stopped
    return null;
  }

  return (
    <div>
      <div 
        className="max-w-none" 
        style={{ color: 'var(--vscode-editor-foreground)' }}
      >
        {visibleTokens.map((token, index) => {
          const prevToken = index > 0 ? visibleTokens[index - 1] : null;
          const nextToken = index < visibleTokens.length - 1 ? visibleTokens[index + 1] : null;
          
          // Margin logic: consistent spacing for all content types
          const marginTop = index === 0 ? '0' : '0.75rem';
          
          if (token.type === 'think') {
            return (
              <div key={`think-${messageId}-${token.index}`} style={{ marginTop, paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                <ThinkBlock
                  content={token.content}
                  messageId={`${messageId}-${token.index}`}
                  isStreaming={isStreaming && !token.isClosed}
                  isClosed={token.isClosed}
                />
              </div>
            );
          }
          
          // Tool block
          if (token.type === 'tool') {
            // Check adjacent tools in VISIBLE tokens list for sequential grouping
            const isConnectedTop = prevToken?.type === 'tool';
            const isConnectedBottom = nextToken?.type === 'tool';

            // Override margin if connected to top tool (collapse spacing)
            const toolMarginTop = isConnectedTop ? 0 : marginTop;

            // Merge token data with execution state if available
            const executionState = toolExecutions?.get(token.toolExecutionId);
            
            // Special handling: Split multi-file read_file results into separate tool blocks
            if (token.toolName === 'read_file' && executionState?.result?.success && executionState.result.data) {
              const resultData = executionState.result.data as Record<string, unknown>;
              
              // Check if this is a multi-file result
              if ('files' in resultData && Array.isArray(resultData.files) && resultData.files.length > 1) {
                const files = resultData.files as Array<{ path: string; content: string; startLine?: number; endLine?: number; totalLines?: number }>;
                
                // Render each file as a separate tool block
                return (
                  <>
                    {files.map((file, fileIdx) => {
                      const fileToolExecutionId = `${token.toolExecutionId}-file-${fileIdx}`;
                      const fileExecutionState = toolExecutions?.get(fileToolExecutionId);
                      
                      const fileToolCall: ToolCall = {
                        toolName: token.toolName,
                        parameters: { path: file.path, ...token.parameters },
                        status: fileExecutionState?.status || 'completed',
                        result: fileExecutionState?.result || {
                          success: true,
                          data: file
                        },
                        toolExecutionId: fileToolExecutionId,
                      };
                      
                      const isLastFile = fileIdx === files.length - 1;
                      const fileMarginTop = fileIdx === 0 ? toolMarginTop : 0;
                      const fileIsConnectedTop = fileIdx > 0 || isConnectedTop;
                      const fileIsConnectedBottom = !isLastFile || isConnectedBottom;
                      
                      return (
                        <div key={`tool-${messageId}-${token.index}-file-${fileIdx}`} style={{ marginTop: fileMarginTop, paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                          <ToolBlock 
                            toolCall={fileToolCall}
                            isConnectedTop={fileIsConnectedTop}
                            isConnectedBottom={fileIsConnectedBottom}
                            isStreaming={false}
                          />
                        </div>
                      );
                    })}
                  </>
                );
              }
            }
            
            // Normal tool rendering (single file or other tools)
            const toolCall: ToolCall = {
              toolName: token.toolName,
              // Prioritize execution parameters as they are authoritative during execution
              parameters: executionState?.parameters || token.parameters,
              status: executionState?.status || (token.isClosed ? 'completed' : 'pending'),
              result: executionState?.result,
              toolExecutionId: token.toolExecutionId,
              progress: executionState?.progress,
            };
            
            return (
              <div key={`tool-${messageId}-${token.index}`} style={{ marginTop: toolMarginTop, paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
                <ToolBlock 
                  toolCall={toolCall}
                  isConnectedTop={isConnectedTop}
                  isConnectedBottom={isConnectedBottom}
                  isStreaming={isStreaming && !token.isClosed}
                />
              </div>
            );
          }
          
          // Text content - use memoized markdown renderer
          if (token.type === 'text') {
            // visibleTokens already filtered out empty text, but double check just in case
            if (!token.content.trim()) return null;
            
            // Reduce spacing when text follows a think block for tighter visual flow
            const textMarginTop = prevToken?.type === 'think' ? '0.1rem' : marginTop;
            
            return (
              <div key={`text-${messageId}-${token.index}`} style={{ marginTop: textMarginTop, paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                <StableMarkdown 
                  content={sanitizeAssistantText(token.content)} 
                />
              </div>
            );
          }
          
          // Mermaid diagram - render as separate stable block
          if (token.type === 'mermaid') {
            return (
              <div key={`mermaid-${messageId}-${token.index}`} style={{ marginTop, paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                <MermaidBlock 
                  code={token.content} 
                  isGenerating={!token.isClosed}
                />
              </div>
            );
          }
          
          return null;
        })}

        {/* Show loading dots when waiting for response after tool or think block */}
        {isStreaming && (
          (() => {
            // Check if there are filtered tool blocks (incomplete or missing path)
            const hasFilteredToolBlocks = tokens.some(token => {
              if (token.type !== 'tool') return false;
              // Check if path is missing for file modification tools
              const isFileModificationTool = token.toolName === 'write_to_file' || token.toolName === 'apply_diff';
              if (isFileModificationTool) {
                const path = token.parameters.path as string | undefined;
                return !path || path.trim() === '';
              }
              // Check if non-file-modification tool was filtered out
              if (!token.isClosed) return true;
              return false;
            });
            
            // If there are visible tokens, check the last one
            if (visibleTokens.length > 0) {
              const lastToken = visibleTokens[visibleTokens.length - 1];
              
              // Case 1: Tool block - only show dots if completed/error/aborted (waiting for AI)
              // Do NOT show if executing (ToolBlock shows status) or incomplete
              if (lastToken.type === 'tool' && lastToken.isClosed) {
                const status = toolExecutions?.get(lastToken.toolExecutionId)?.status;
                
                // Special check for multi-file read_file: wait for all files to complete diagnostics
                const executionState = toolExecutions?.get(lastToken.toolExecutionId);
                if (lastToken.toolName === 'read_file' && executionState?.result?.success && executionState.result.data) {
                  const resultData = executionState.result.data as Record<string, unknown>;
                  if ('files' in resultData && Array.isArray(resultData.files) && resultData.files.length > 1) {
                    // Check if all split file executions are done with diagnostics
                    const files = resultData.files as Array<unknown>;
                    const allFilesCompleted = files.every((_, fileIdx) => {
                      const fileStatus = toolExecutions?.get(`${lastToken.toolExecutionId}-file-${fileIdx}`)?.status;
                      return fileStatus === 'completed' || fileStatus === 'error' || fileStatus === 'aborted';
                    });
                    
                    if (allFilesCompleted) {
                      return (
                        <div className="mt-2" style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                          <LoadingDots />
                        </div>
                      );
                    }
                    // Still linting, don't show loading dots yet
                    return null;
                  }
                }
                
                // Normal single-tool case
                if (status === 'completed' || status === 'error' || status === 'aborted') {
                  return (
                    <div className="mt-2" style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                      <LoadingDots />
                    </div>
                  );
                }
              }
              
              // Case 2: Think block - show dots if closed (waiting for text)
              if (lastToken.type === 'think' && lastToken.isClosed) {
                return (
                  <div className="mt-2" style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                    <LoadingDots />
                  </div>
                );
              }
              
              // Case 3: Has filtered tool blocks after visible content - show loading dots
              if (hasFilteredToolBlocks) {
                return (
                  <div className="mt-2" style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                    <LoadingDots />
                  </div>
                );
              }
            } else if (tokens.length > 0) {
              // Case 4: Have tokens but all filtered (incomplete tool blocks) - show loading dots
              return (
                <div style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                  <LoadingDots />
                </div>
              );
            }
            
            return null;
          })()
        )}
      </div>
    </div>
  );
}

export const AssistantMessage = memo(AssistantMessageComponent, (prev, next) => {
  // Compare toolExecutions maps by size and entries (including progress)
  const toolExecutionsEqual = 
    prev.toolExecutions === next.toolExecutions ||
    (prev.toolExecutions?.size === next.toolExecutions?.size &&
     Array.from(prev.toolExecutions?.entries() || []).every(([key, value]) => {
       const nextValue = next.toolExecutions?.get(key);
       return nextValue?.status === value.status && 
              nextValue?.result === value.result &&
              nextValue?.progress?.iteration === value.progress?.iteration &&
              nextValue?.progress?.phase === value.progress?.phase &&
              (nextValue?.progress?.tools?.length || 0) === (value.progress?.tools?.length || 0);
     }));
  
  return prev.content === next.content && 
         prev.messageId === next.messageId && 
         prev.isStreaming === next.isStreaming &&
         toolExecutionsEqual;
});