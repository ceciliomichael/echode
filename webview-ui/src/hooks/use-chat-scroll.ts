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

  const lastScrollTopRef = useRef(0);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const elem = scrollContainerRef.current;
    if (!elem) return;

    const { scrollTop, scrollHeight, clientHeight } = elem;
    
    // Check if we are at the bottom (with a 4px tolerance)
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 4;
    
    // Determine scroll direction
    // If scrollTop < lastScrollTop, user is scrolling UP.
    // If scrollTop > lastScrollTop, user is scrolling DOWN (or content pushed us down).
    const isScrollingUp = scrollTop < lastScrollTopRef.current;
    
    // Update reference for next event
    lastScrollTopRef.current = scrollTop;

    /**
     * Intelligent Auto-Scroll Logic:
     * 1. If we are at the bottom, we are definitely "pinned" (userHasScrolled = false).
     * 2. If we are scrolling UP (delta < 0), the user is intentionally leaving the bottom.
     *    Set userHasScrolled = true.
     * 3. If we are scrolling DOWN (delta > 0) but NOT at the bottom yet:
     *    This happens when content grows and we are auto-scrolling to catch up.
     *    In this case, we DO NOT unpin. We assume it's the auto-scroller working.
     */
    if (isAtBottom) {
      setUserHasScrolled(false);
    } else if (isScrollingUp) {
      setUserHasScrolled(true);
    }
    // implicit else: scrolling down but not at bottom -> keep existing state.
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
        // Calculate how far we are from the bottom
        const distanceFromBottom = elem.scrollHeight - elem.scrollTop - elem.clientHeight;
        
        // Only force scroll if we've drifted more than 10px from the bottom.
        // This prevents fighting with browser's native scroll anchoring during
        // CSS transitions (e.g., think block collapse), which handles small adjustments.
        if (distanceFromBottom > 10) {
          elem.scrollTop = elem.scrollHeight;
        }
      }
    });

    // Observe the container
    resizeObserver.observe(elem);

    // Observe all immediate children for granular resize detection
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