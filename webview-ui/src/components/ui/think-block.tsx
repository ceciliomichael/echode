/**
 * Standalone ThinkBlock Component
 * A self-contained, reusable component for displaying collapsible "thinking" blocks
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { getThinkBlockDuration, setThinkBlockDuration } from '../../utils/think-block-storage';
import { formatDuration } from '../../utils/format-duration';
import { MarkdownRenderer } from './markdown-renderer';

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
// Main Component
// ============================================================================

const ThinkBlockComponent = ({
  content,
  isStreaming = false,
  messageId,
  isClosed = false,
}: ThinkBlockProps) => {
  const [isExpanded, setIsExpanded] = useState(() => isStreaming); // Start expanded if already streaming
  const [duration, setDuration] = useState(() => getThinkBlockDuration(messageId, content));
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoExpandedRef = useRef(isStreaming); // Already expanded if starting in streaming state

  // Handle streaming timing and auto-expand
  useEffect(() => {
    if (isStreaming) {
      // Start timing
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
      }

      // Auto-expand when streaming starts (only once)
      if (!hasAutoExpandedRef.current) {
        hasAutoExpandedRef.current = true;
        // Use flushSync alternative - schedule state update
        requestAnimationFrame(() => setIsExpanded(true));
      }

      // Update duration every 500ms while streaming (less frequent = less lag)
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          if (startTimeRef.current !== null) {
            setDuration(Date.now() - startTimeRef.current);
          }
        }, 500);
      }
    } else if (startTimeRef.current !== null) {
      // Streaming finished - set final duration
      const finalDuration = Date.now() - startTimeRef.current;
      setDuration(finalDuration);
      setThinkBlockDuration(messageId, content, finalDuration);
      startTimeRef.current = null;

      // Clear interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isStreaming, messageId, content]);

  // Auto-collapse when closed
  useEffect(() => {
    if (isClosed && !isStreaming) {
      const timeout = setTimeout(() => setIsExpanded(false), 150);
      return () => clearTimeout(timeout);
    }
  }, [isClosed, isStreaming]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const trimmedContent = content.trim();

  return (
    <div className="group/think">
      {/* Header button */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="inline-flex items-center gap-1 text-sm hover:opacity-80"
        style={{ color: 'var(--vscode-descriptionForeground)', outline: 'none' }}
      >
        {!isClosed ? (
          <span className="thinking-shimmer">Thinking</span>
        ) : (
          <span>Thought for {formatDuration(duration)}</span>
        )}
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
        ) : (
          <ChevronRight
            className={`w-3.5 h-3.5 ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover/think:opacity-100'}`}
            strokeWidth={1.5}
          />
        )}
      </button>

      {/* Collapsible content - simple hide/show, no expensive max-height transition */}
      {isExpanded && (
        <div
          className="text-sm mt-1"
          style={{
            color: 'var(--vscode-disabledForeground)',
            opacity: 0.7,
            fontFamily: 'var(--vscode-font-family)',
          }}
        >
          <MarkdownRenderer content={trimmedContent} />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Memoized Export
// ============================================================================

export const ThinkBlock = memo(ThinkBlockComponent, (prevProps, nextProps) => {
  // Skip re-render if nothing meaningful changed
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  if (prevProps.isClosed !== nextProps.isClosed) return false;
  if (prevProps.messageId !== nextProps.messageId) return false;
  if (prevProps.content !== nextProps.content) return false;
  return true;
});
