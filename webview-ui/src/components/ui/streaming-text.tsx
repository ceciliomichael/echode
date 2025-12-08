import { memo } from 'react';
import { MarkdownRenderer } from './markdown-renderer';

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

// Simple streaming text component without staggered fade-in animation.
// It still re-renders on streaming updates so content appears progressively.
function StreamingTextComponent({ content }: StreamingTextProps) {
  return (
    <div className="streaming-text-container">
      <MarkdownRenderer content={content} />
    </div>
  );
}

export const StreamingText = memo(StreamingTextComponent, (prev, next) => {
  // Always re-render during streaming so new content appears immediately.
  if (next.isStreaming) return false;
  return prev.content === next.content && prev.isStreaming === next.isStreaming;
});
