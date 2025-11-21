import { memo, useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { LoadingDots } from './loading-dots';
import { ThinkBlock } from './think-block';
import { ToolBlock } from './tool-block';
import { StableMarkdown } from './stable-markdown';
import { tokenizeContent } from '../../utils/content-tokenizer';
import type { ToolCall, ToolExecutionState } from '../../types/tool';

interface AssistantMessageProps {
  content: string;
  messageId?: string;
  isStreaming?: boolean;
  showCopy?: boolean;
  toolExecutions?: Map<string, ToolExecutionState>;
}

function AssistantMessageComponent({ content, messageId = 'unknown', isStreaming = false, showCopy = false, toolExecutions }: AssistantMessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Tokenize content into stable segments
  const tokens = useMemo(() => tokenizeContent(content, messageId), [content, messageId]);

  // Filter out only empty text tokens (keep incomplete tool blocks to show loading dots)
  const visibleTokens = useMemo(() => {
    return tokens.filter(token => {
      // Filter empty text
      if (token.type === 'text' && token.content.trim() === '') {
        return false;
      }
      return true;
    });
  }, [tokens]);

  const shouldShowCopyRow = useMemo(
    () => !isStreaming && showCopy,
    [isStreaming, showCopy]
  );

  const handleCopy = () => {
    // Extract only text content (exclude think blocks)
    const textContent = tokens
      .filter(token => token.type === 'text')
      .map(token => token.content)
      .join('');
    
    navigator.clipboard.writeText(textContent);
    setIsCopied(true);
    
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };
  
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
    <div 
      className="group relative" 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="max-w-none" 
        style={{ color: 'var(--vscode-editor-foreground)' }}
      >
        {visibleTokens.map((token, index) => {
          const prevToken = index > 0 ? visibleTokens[index - 1] : null;
          const nextToken = index < visibleTokens.length - 1 ? visibleTokens[index + 1] : null;
          const isPrevThink = prevToken?.type === 'think';
          
          // Much smaller margin after think blocks (like paragraph spacing), normal margin otherwise
          const marginTop = index === 0 ? '0' : isPrevThink ? '0.25rem' : '0.75rem';
          
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
            
            // Normal tool rendering (batch files are already split into individual tokens by tokenizer)
            const toolCall: ToolCall = {
              toolName: token.toolName,
              // Prioritize execution parameters as they are authoritative during execution
              parameters: executionState?.parameters || token.parameters,
              status: executionState?.status || (token.isClosed ? 'completed' : 'pending'),
              result: executionState?.result,
              toolExecutionId: token.toolExecutionId,
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
            
            return (
              <div key={`text-${messageId}-${token.index}`} style={{ marginTop, paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                <StableMarkdown 
                  content={token.content} 
                />
              </div>
            );
          }
          
          return null;
        })}

        {/* Show loading dots when waiting for response after tool or think block */}
        {isStreaming && (
          (() => {
            // If there are visible tokens, check the last one
            if (visibleTokens.length > 0) {
              const lastToken = visibleTokens[visibleTokens.length - 1];
              
              // Case 1: Tool block - only show dots if completed/error/aborted (waiting for AI)
              // Do NOT show if executing (ToolBlock shows status) or incomplete
              if (lastToken.type === 'tool' && lastToken.isClosed) {
                const status = toolExecutions?.get(lastToken.toolExecutionId)?.status;
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
            } else if (tokens.length > 0) {
              // Case 3: Have tokens but all filtered (incomplete tool blocks) - show loading dots
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
      {shouldShowCopyRow && (
        <div 
          className={`mt-1 flex justify-end transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          style={{ pointerEvents: isHovered ? 'auto' : 'none', paddingRight: '1.25rem' }}
        >
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-xs transition-opacity"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--vscode-foreground)',
              opacity: isCopied ? 1 : 0.7,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = isCopied ? '1' : '0.7';
            }}
          >
            {isCopied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}

export const AssistantMessage = memo(AssistantMessageComponent, (prev, next) => {
  // Compare toolExecutions maps by size and entries
  const toolExecutionsEqual = 
    prev.toolExecutions === next.toolExecutions ||
    (prev.toolExecutions?.size === next.toolExecutions?.size &&
     Array.from(prev.toolExecutions?.entries() || []).every(([key, value]) => {
       const nextValue = next.toolExecutions?.get(key);
       return nextValue?.status === value.status && nextValue?.result === value.result;
     }));
  
  return prev.content === next.content && 
         prev.messageId === next.messageId && 
         prev.isStreaming === next.isStreaming &&
         prev.showCopy === next.showCopy &&
         toolExecutionsEqual;
});