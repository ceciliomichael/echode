import { useEffect, useMemo, useState, useRef } from 'react';
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
): void {
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const numUserMsgs = useMemo(() => getNumUserMsgs(messages), [messages.length]);
  
  // Track if a scroll event was initiated by our code (ResizeObserver)
  const isAutoScrolling = useRef(false);

  // Reset scroll state when a new user message is added
  useEffect(() => {
    setUserHasScrolled(false);
  }, [numUserMsgs]);

  useEffect(() => {
    if (!ref.current || messages.length === 0) return;

    const handleScroll = () => {
      // If the scroll was triggered programmatically by us (e.g. ResizeObserver),
      // ignore this event so we don't accidentally flag it as a user scroll.
      if (isAutoScrolling.current) {
        return;
      }

      const elem = ref.current;
      if (!elem) return;

      // Check if user is at the bottom with a permissive threshold (10px)
      // This accounts for sub-pixel rendering and browser quirks during layout shifts
      const isAtBottom =
        Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < 10;

      /**
       * We stop auto scrolling if a user manually scrolled up.
       * We resume auto scrolling if a user manually scrolled to the bottom.
       */
      setUserHasScrolled(!isAtBottom);
    };

    const resizeObserver = new ResizeObserver(() => {
      const elem = ref.current;
      if (!elem || userHasScrolled) return;
      
      // Mark this as a programmatic scroll
      isAutoScrolling.current = true;
      
      // Auto-scroll to bottom
      elem.scrollTop = elem.scrollHeight;
      
      // Reset the flag after a short delay to ensure the scroll event has fired/settled.
      // 50ms is enough to cover the next tick where the scroll event usually fires.
      setTimeout(() => {
        isAutoScrolling.current = false;
      }, 50);
    });

    ref.current.addEventListener('scroll', handleScroll);

    // Observe the container itself
    resizeObserver.observe(ref.current);

    // Observe all immediate children for size changes
    Array.from(ref.current.children).forEach((child) => {
      resizeObserver.observe(child);
    });

    return () => {
      resizeObserver.disconnect();
      ref.current?.removeEventListener('scroll', handleScroll);
    };
  }, [ref, messages.length, userHasScrolled]);
}