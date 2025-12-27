import { useEffect, useMemo, useRef } from 'react';
import type { Message } from '../types/chat';

/**
 * Only reset scroll state when a new user message is added to the chat.
 */
function getNumUserMsgs(messages: Message[]) {
  return messages.filter((msg) => msg.role === 'user').length;
}

/**
 * Auto-scroll hook that follows content during streaming.
 * 
 * Logic:
 * 1. ResizeObserver detects content size change
 * 2. If user hasn't scrolled up, scroll to bottom
 * 3. Scroll event checks distance from bottom:
 *    - < 50px = "at bottom" (keep auto-scrolling)
 *    - > 50px = "user scrolled up" (pause auto-scroll)
 * 4. Reset on new user message (resume auto-scroll)
 * 
 * IMPORTANT: Uses refs instead of state to avoid effect teardown/re-setup
 * which was causing scroll "bouncing" and erratic scrollbar behavior.
 */
export const useAutoScroll = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  messages: Message[],
) => {
  // Use ref to avoid re-renders and effect teardowns when scroll state changes
  const userHasScrolledRef = useRef(false);
  const numUserMsgs = useMemo(() => getNumUserMsgs(messages), [messages.length]);

  // Reset scroll state when a new user message is added
  useEffect(() => {
    userHasScrolledRef.current = false;
  }, [numUserMsgs]);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || messages.length === 0) return;

    // Stable scroll function that reads ref directly
    const scrollToBottom = () => {
      if (userHasScrolledRef.current) return;

      requestAnimationFrame(() => {
        if (container && !userHasScrolledRef.current) {
          container.scrollTop = container.scrollHeight;
        }
      });
    };

    const handleScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;

      // 50px threshold: generous buffer to avoid false positives from
      // subpixel rendering, zoom levels, or minor scroll adjustments
      const isAtBottom = distanceFromBottom < 50;

      // User scrolled up = pause auto-scroll
      // User at bottom = resume auto-scroll
      userHasScrolledRef.current = !isAtBottom;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    // Initial scroll
    scrollToBottom();

    // Observe content size changes (captures streaming updates)
    const resizeObserver = new ResizeObserver(() => {
      scrollToBottom();
    });

    if (content) {
      resizeObserver.observe(content);
    } else {
      // Fallback: observe container if content ref isn't available yet
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, contentRef, messages.length]);
};