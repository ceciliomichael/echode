import { useRef, useState, useEffect, useCallback } from 'react';

interface ChatScrollState {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollContentRef: React.RefObject<HTMLDivElement | null>;
  isAutoScrollEnabled: boolean;
  handleScroll: () => void;
  scrollToBottom: (options?: { behavior?: 'auto' | 'smooth' }) => void;
  setIsAutoScrollEnabled: (enabled: boolean) => void;
}

/**
 * Simplified autoscroll hook based on Continue's implementation.
 * Key improvements:
 * - Simple binary state (at bottom or not)
 * - No complex delta tracking
 * - Observes all immediate children for granular resize detection
 * - Only resets on new user messages (not all messages)
 */
export function useChatScroll(
  userMessageCount: number,
): ChatScrollState {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  
  // userHasScrolled is true if the user has manually scrolled up away from the bottom.
  // It is false if the user is at the bottom or a new user message has arrived.
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((options?: { behavior?: 'auto' | 'smooth' }) => {
    const elem = scrollContainerRef.current;
    if (elem) {
      elem.scrollTo({
        top: elem.scrollHeight,
        behavior: options?.behavior || 'auto'
      });
    }
  }, []);

  // Handle scroll events - simple "at bottom" check
  const handleScroll = useCallback(() => {
    const elem = scrollContainerRef.current;
    if (!elem) return;

    // Check if we are at the bottom (with a tight 1px tolerance)
    const isAtBottom = Math.abs(elem.scrollHeight - elem.scrollTop - elem.clientHeight) < 1;
    
    /**
     * We stop auto scrolling if a user manually scrolled up.
     * We resume auto scrolling if a user manually scrolled to the bottom.
     */
    setUserHasScrolled(!isAtBottom);
  }, []);

  // Reset scroll state when a new USER message is added
  // (not on every assistant message/tool call to avoid unwanted jumps)
  useEffect(() => {
    setUserHasScrolled(false);
  }, [userMessageCount]);

  // Use ResizeObserver to keep the view pinned to the bottom when content grows
  useEffect(() => {
    const elem = scrollContainerRef.current;
    if (!elem) return;

    const resizeObserver = new ResizeObserver(() => {
      // If user hasn't scrolled up, keep pinned to bottom
      if (!userHasScrolled && elem) {
        requestAnimationFrame(() => {
          elem.scrollTop = elem.scrollHeight;
        });
      }
    });

    // Observe the container
    resizeObserver.observe(elem);

    // Observe all immediate children for granular resize detection
    // This ensures we catch height changes from streaming text, thinking blocks, etc.
    Array.from(elem.children).forEach((child) => {
      resizeObserver.observe(child);
    });

    // Attach scroll event listener
    elem.addEventListener('scroll', handleScroll);

    return () => {
      resizeObserver.disconnect();
      elem.removeEventListener('scroll', handleScroll);
    };
  }, [userHasScrolled, handleScroll]);

  const setIsAutoScrollEnabled = useCallback((enabled: boolean) => {
    setUserHasScrolled(!enabled);
  }, []);

  return {
    scrollContainerRef,
    scrollContentRef,
    isAutoScrollEnabled: !userHasScrolled,
    handleScroll,
    scrollToBottom,
    setIsAutoScrollEnabled,
  };
}