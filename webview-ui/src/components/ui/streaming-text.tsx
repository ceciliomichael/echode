import { useRef, useEffect, memo } from 'react';
import { MarkdownRenderer } from './markdown-renderer';

interface StreamingTextProps {
  content: string;
  isStreaming: boolean;
}

/**
 * Streaming text component with staggered fade-in effect.
 * Tracks content changes and applies fade animation to new text chunks.
 */
function StreamingTextComponent({ content, isStreaming }: StreamingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevContentLengthRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isStreaming || !containerRef.current) {
      prevContentLengthRef.current = content.length;
      return;
    }

    // Find all text nodes and apply staggered fade to new content
    const applyFadeEffect = () => {
      const container = containerRef.current;
      if (!container) return;

      // Get all descendant elements that might contain new text
      const elements = container.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, span, strong, em, code, td, th, blockquote');
      
      elements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        // Only apply to elements without the fade class already
        if (!htmlEl.dataset.streamed) {
          htmlEl.style.opacity = '0';
          htmlEl.style.animation = 'streamFadeIn 300ms ease-out forwards';
          htmlEl.dataset.streamed = 'true';
        }
      });

      prevContentLengthRef.current = content.length;
    };

    // Debounce the effect slightly to batch rapid updates
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(applyFadeEffect);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [content, isStreaming]);

  // Reset animation state when streaming stops
  useEffect(() => {
    if (!isStreaming && containerRef.current) {
      // Remove all streaming markers and ensure full opacity
      const elements = containerRef.current.querySelectorAll('[data-streamed]');
      elements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.opacity = '1';
        htmlEl.style.animation = '';
        delete htmlEl.dataset.streamed;
      });
      prevContentLengthRef.current = 0;
    }
  }, [isStreaming]);

  return (
    <div ref={containerRef} className="streaming-text-container">
      <MarkdownRenderer content={content} />
    </div>
  );
}

export const StreamingText = memo(StreamingTextComponent, (prev, next) => {
  // Always re-render during streaming to apply effects
  if (next.isStreaming) return false;
  return prev.content === next.content && prev.isStreaming === next.isStreaming;
});
