import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import type { Message } from '../types/chat';

/**
 * Only reset scroll state when a new user message is added to the chat.
 */
function getNumUserMsgs(messages: Message[]) {
  return messages.filter((msg) => msg.role === 'user').length;
}

export const useAutoScroll = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  messages: Message[],
) => {
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const numUserMsgs = useMemo(() => getNumUserMsgs(messages), [messages.length]);
  const isAutoScrolling = useRef(false);

  // Reset scroll state when a new user message is added
  useEffect(() => {
    setUserHasScrolled(false);
  }, [numUserMsgs]);

  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container || userHasScrolled) return;

    isAutoScrolling.current = true;
    
    // Use requestAnimationFrame to ensure we scroll after layout updates
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      
      // Reset the flag after a short delay to allow the scroll event to fire and be ignored
      setTimeout(() => {
        isAutoScrolling.current = false;
      }, 100);
    });
  }, [containerRef, userHasScrolled]);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    
    if (!container || messages.length === 0) return;

    const handleScroll = () => {
      // Ignore scroll events caused by our own auto-scrolling
      if (isAutoScrolling.current) return;

      const isAtBottom =
        Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 30;

      // Stop auto-scroll if user manually scrolled up, resume if at bottom
      setUserHasScrolled(!isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);

    // Initial scroll
    scrollToBottom();

    // Observe content size changes (this captures streaming updates effectively)
    const resizeObserver = new ResizeObserver(() => {
      scrollToBottom();
    });

    if (content) {
      resizeObserver.observe(content);
    } else {
      // Fallback: observe container scrollHeight changes if content ref isn't available yet
      // This might happen if messages > 0 but the inner div hasn't mounted for some reason
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, contentRef, messages.length, scrollToBottom]);
};