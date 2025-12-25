/**
 * Standalone ThinkBlock Component
 * A self-contained, reusable component for displaying collapsible "thinking" blocks
 * 
 * Dependencies:
 * - React (peer dependency)
 * - lucide-react (for icons)
 * 
 * Usage:
 * ```tsx
 * import { ThinkBlock } from './think-block';
 * 
 * <ThinkBlock
 *   content="Your thinking content here..."
 *   isStreaming={false}
 *   messageId="unique-message-id"
 * />
 * ```
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { memo, useEffect, useRef, useState, useDeferredValue } from 'react';
import { getThinkBlockDuration, setThinkBlockDuration } from '../../utils/think-block-storage';
import { formatDuration } from '../../utils/format-duration';
import { StreamingText } from './streaming-text';

// ============================================================================
// Types
// ============================================================================

interface ThinkBlockProps {
  content: string;
  isStreaming?: boolean;
  messageId: string | number;
  isClosed?: boolean;
}

// ============================================================================
// Memoized Content Component
// ============================================================================

const ThinkContent = memo(
  ({ content, isStreaming }: { content: string; isStreaming: boolean }) => {
    return (
      <div 
        className="text-sm m-0"
        style={{ 
          color: 'var(--vscode-disabledForeground)',
          opacity: 0.7,
          fontFamily: 'var(--vscode-font-family)'
        }}
      >
        <StreamingText content={content.trim()} isStreaming={isStreaming} />
      </div>
    );
  },
  (prev, next) => prev.content === next.content && prev.isStreaming === next.isStreaming
);

// ============================================================================
// Main Component
// ============================================================================

const ThinkBlockComponent = ({
  content,
  isStreaming = false,
  messageId,
  isClosed = false,
}: ThinkBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [duration, setDuration] = useState(() =>
    getThinkBlockDuration(messageId, content)
  );
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoadedFromStorageRef = useRef(false);
  const hasAutoExpandedRef = useRef(false);

  // Load duration from storage on mount (hydration-safe)
  useEffect(() => {
    if (!hasLoadedFromStorageRef.current) {
      const storedDuration = getThinkBlockDuration(messageId, content);
      if (storedDuration > 0) {
        const timeoutId = setTimeout(() => setDuration(storedDuration), 0);
        hasLoadedFromStorageRef.current = true;
        return () => clearTimeout(timeoutId);
      }
      hasLoadedFromStorageRef.current = true;
    }
  }, [messageId, content]);

  // Track timing when streaming starts/stops
  useEffect(() => {
    if (isStreaming) {
      // Start timing
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }

      // Auto-expand when streaming starts (only once)
      if (!hasAutoExpandedRef.current) {
        queueMicrotask(() => setIsExpanded(true));
        hasAutoExpandedRef.current = true;
      }

      // Update duration every 100ms while streaming
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          if (startTimeRef.current !== null) {
            setDuration(Date.now() - startTimeRef.current);
          }
        }, 100);
      }
    } else {
      // Streaming finished
      if (startTimeRef.current !== null) {
        // Set final duration
        const finalDuration = Date.now() - startTimeRef.current;
        setDuration(finalDuration);
        // Persist duration to localStorage
        setThinkBlockDuration(messageId, content, finalDuration);
        startTimeRef.current = null;
      }

      // Auto-collapse when complete (only if closed)
      if (isClosed) {
        setIsExpanded(false);
      }

      // Clear intervals
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      // Save duration on unmount if streaming was active
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (startTimeRef.current !== null) {
        const finalDuration = Date.now() - startTimeRef.current;
        setThinkBlockDuration(messageId, content, finalDuration);
      }
    };
  }, [isStreaming, isClosed, messageId, content]);


  const deferredContent = useDeferredValue(content);

  return (
    <div className="group/think">
      {/* Inline dropdown trigger - looks like text */}
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1 transition-colors"
          style={{
            color: 'var(--vscode-descriptionForeground)',
            outline: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--vscode-foreground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
          }}
        >
          {!isClosed ? (
            <span
              className="text-sm"
              style={{
                background: 'linear-gradient(90deg, var(--vscode-descriptionForeground) 0%, var(--vscode-descriptionForeground) 40%, var(--vscode-foreground) 50%, var(--vscode-descriptionForeground) 60%, var(--vscode-descriptionForeground) 100%)',
                backgroundSize: '300% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'wave-shine 2s linear infinite'
              }}
            >
              Thinking
            </span>
          ) : (
            <span className="text-sm">
              Thought for {formatDuration(duration)}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 transition-all duration-200" strokeWidth={1.5} />
          ) : (
            <ChevronRight
              className={`w-3.5 h-3.5 transition-all duration-200 ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover/think:opacity-100'}`}
              strokeWidth={1.5}
            />
          )}
        </button>
      </div>

      {/* Content - expands inline with smooth animation */}
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
          isExpanded
            ? 'max-h-[5000px] opacity-100 mt-1'
            : 'max-h-0 opacity-0 mt-0'
        }`}
        style={{
          contentVisibility: isExpanded ? 'auto' : 'hidden',
        }}
      >
        <ThinkContent content={deferredContent} isStreaming={isStreaming} />
      </div>
    </div>
  );
};

// ============================================================================
// Memoized Export
// ============================================================================

export const ThinkBlock = memo(ThinkBlockComponent, (prevProps, nextProps) => {
  return (
    prevProps.content === nextProps.content &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.messageId === nextProps.messageId &&
    prevProps.isClosed === nextProps.isClosed
  );
});
