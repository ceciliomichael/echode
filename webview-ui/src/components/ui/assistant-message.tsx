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
}

function AssistantMessageComponent({ content, messageId = 'unknown', isStreaming = false }: AssistantMessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Tokenize content into stable segments
  const tokens = useMemo(() => tokenizeContent(content), [content]);
  
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
    return (
      <div className="py-2" style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
        <div className="max-w-none">
          <LoadingDots />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="py-2 group relative" 
      style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="max-w-none" 
        style={{ color: 'var(--vscode-editor-foreground)' }}
      >
        {tokens.map((token) => {
          if (token.type === 'think') {
            return (
              <ThinkBlock
                key={`think-${messageId}-${token.index}`}
                content={token.content}
                messageId={`${messageId}-${token.index}`}
                isStreaming={isStreaming && !token.isClosed}
                isClosed={token.isClosed}
              />
            );
          }
          
          // Text content - use memoized markdown renderer
          if (token.content.trim()) {
            return (
              <StableMarkdown 
                key={`text-${messageId}-${token.index}`} 
                content={token.content} 
              />
            );
          }
          
          return null;
        })}
      </div>
      
      {isHovered && !isStreaming && (
        <button
          onClick={handleCopy}
          className="absolute transition-opacity"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'var(--vscode-foreground)',
            opacity: 0.6,
            right: '1.25rem',
            bottom: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.6';
          }}
        >
          {isCopied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      )}
    </div>
  );
}

export const AssistantMessage = memo(AssistantMessageComponent, (prev, next) => {
  return prev.content === next.content && 
         prev.messageId === next.messageId && 
         prev.isStreaming === next.isStreaming;
});