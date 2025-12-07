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
    const container = containerRef.current;
    if (!isStreaming || !container) {
      prevContentLengthRef.current = content.length;
      return;
    }

    // Skip work if length has not changed (prevents re-applying on noop renders)
    if (content.length === prevContentLengthRef.current) {
      return;
    }

    // Find all text nodes and apply staggered fade to new content
    const applyFadeEffect = () => {
      const container = containerRef.current;
      if (!container) return;

      const fadeTargetsSelector =
        'p, li, h1, h2, h3, h4, h5, h6, span, strong, em, pre, code, td, th, blockquote';
      const newElements = Array.from(container.querySelectorAll<HTMLElement>(fadeTargetsSelector)).filter(
        element => !element.dataset.streamed
      );

      newElements.forEach((element, index) => {
        const delayMs = Math.min(index * 28, 320);
        element.style.setProperty('--streaming-delay', `${delayMs}ms`);
        element.style.opacity = '0';
        element.dataset.streamed = 'true';
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
      const elements = containerRef.current.querySelectorAll<HTMLElement>('[data-streamed]');
      elements.forEach((element) => {
        element.style.opacity = '1';
        element.style.removeProperty('--streaming-delay');
        delete element.dataset.streamed;
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
