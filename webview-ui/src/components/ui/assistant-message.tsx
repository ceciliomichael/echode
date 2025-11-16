import { memo, useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { LoadingDots } from './loading-dots';
import { ThinkBlock } from './think-block';
import { StableMarkdown } from './stable-markdown';
import { tokenizeContent } from '../../utils/content-tokenizer';

interface AssistantMessageProps {
  content: string;
  messageId?: string;
  isStreaming?: boolean;
  showCopy?: boolean;
}

function AssistantMessageComponent({ content, messageId = 'unknown', isStreaming = false, showCopy = false }: AssistantMessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Tokenize content into stable segments
  const tokens = useMemo(() => tokenizeContent(content), [content]);
  
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
      style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="max-w-none" 
        style={{ color: 'var(--vscode-editor-foreground)' }}
      >
        {tokens.map((token, index) => {
          const prevToken = index > 0 ? tokens[index - 1] : null;
          const isPrevThink = prevToken?.type === 'think';
          
          // Much smaller margin after think blocks (like paragraph spacing), normal margin otherwise
          const marginTop = index === 0 ? '0' : isPrevThink ? '0.25rem' : '0.75rem';
          
          if (token.type === 'think') {
            return (
              <div key={`think-${messageId}-${token.index}`} style={{ marginTop }}>
                <ThinkBlock
                  content={token.content}
                  messageId={`${messageId}-${token.index}`}
                  isStreaming={isStreaming && !token.isClosed}
                  isClosed={token.isClosed}
                />
              </div>
            );
          }
          
          // Text content - use memoized markdown renderer
          if (token.content.trim()) {
            return (
              <div key={`text-${messageId}-${token.index}`} style={{ marginTop }}>
                <StableMarkdown 
                  content={token.content} 
                />
              </div>
            );
          }
          
          return null;
        })}
      </div>
      {shouldShowCopyRow && (
        <div 
          className={`mt-1 flex justify-end transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          style={{ pointerEvents: isHovered ? 'auto' : 'none' }}
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
  return prev.content === next.content && 
         prev.messageId === next.messageId && 
         prev.isStreaming === next.isStreaming &&
         prev.showCopy === next.showCopy;
});