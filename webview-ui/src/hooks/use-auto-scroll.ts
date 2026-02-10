import { useEffect, useMemo, useRef } from 'react';
import type { Message } from '../types/chat';

/**
 * Count user messages in the chat history.
 * Only reset scroll state when a new user message is added,
 * not on tool responses or assistant streaming.
 */
function getNumUserMsgs(messages: Message[]): number {
  return messages.filter((msg) => msg.role === 'user').length;
}

/**
 * Auto-scroll hook that provides smart scrolling behavior for chat interfaces.
 * 
 * Behavior:
 * - Automatically scrolls to bottom when new content is added (via ResizeObserver)
 * - Stops auto-scrolling if user manually scrolls up
 * - Resumes auto-scrolling if user scrolls back to bottom
 * - Resets scroll state when a new user message is added
 * - Robust handling of dynamic content changes (collapsing blocks) via programmatic scroll guards
 * 
 * @param ref - Reference to the scrollable container element
 * @param messages - Array of chat messages to track
 */
export function useAutoScroll(
  ref: React.RefObject<HTMLDivElement | null>,
  messages: Message[],
  shouldAutoScroll: boolean = true,
): void {
  // Use ref instead of state to avoid stale closures in ResizeObserver
  const userHasScrolledRef = useRef(false);
  const numUserMsgs = useMemo(() => getNumUserMsgs(messages), [messages.length]);
  
  // Track if a scroll event was initiated by our code (ResizeObserver)
  const isAutoScrolling = useRef(false);

  // Reset scroll state when a new user message is added
  useEffect(() => {
    userHasScrolledRef.current = false;
  }, [numUserMsgs]);

  useEffect(() => {
    if (!ref.current) return;
    const elem = ref.current;

    const handleScroll = () => {
      // If the scroll was triggered programmatically by us (e.g. ResizeObserver),
      // ignore this event so we don't accidentally flag it as a user scroll.
      if (isAutoScrolling.current) {
        return;
      }

      // If auto-scroll is disabled (e.g. editing a message), we shouldn't update
      // the state.
      if (!shouldAutoScroll) {
        return;
      }

      // Check if user is at the bottom with a permissive threshold
      // This accounts for sub-pixel rendering and browser quirks during layout shifts
      const isAtBottom =
        Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < 25;

      /**
       * We stop auto scrolling if a user manually scrolled up.
       * We resume auto scrolling if a user manually scrolled to the bottom.
       */
      userHasScrolledRef.current = !isAtBottom;
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!elem || userHasScrolledRef.current || !shouldAutoScroll) return;
      
      // Mark this as a programmatic scroll
      isAutoScrolling.current = true;
      
      // Auto-scroll to bottom
      elem.scrollTop = elem.scrollHeight;
      
      // Reset the flag after a short delay to ensure the scroll event has fired/settled.
      setTimeout(() => {
        isAutoScrolling.current = false;
      }, 50);
    });

    elem.addEventListener('scroll', handleScroll);

    // Observe the container itself (triggers when chat input resizes)
    resizeObserver.observe(elem);

    // Observe all immediate children for size changes
    Array.from(elem.children).forEach((child) => {
      resizeObserver.observe(child);
    });

    return () => {
      resizeObserver.disconnect();
      elem.removeEventListener('scroll', handleScroll);
    };
  }, [ref, shouldAutoScroll]); // Removed messages.length and userHasScrolled from deps
}