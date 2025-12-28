import { useEffect, useMemo, useRef } from 'react';
import type { Message } from '../types/chat';

function getNumUserMsgs(messages: Message[]) {
  return messages.filter((msg) => msg.role === 'user').length;
}

/**
 * Auto-scroll hook with proper user intent detection.
 * 
 * Key insight: scroll events fire for BOTH user scrolls AND programmatic scrolls.
 * Using scroll event alone causes feedback loops where programmatic scroll
 * triggers event → recalculates position → re-enables auto-scroll → traps user.
 * 
 * Solution:
 * - wheel/touch events: Detect user INTENT to scroll up → immediately pause
 * - scroll event: Only used to RE-ENABLE when user naturally scrolls to bottom
 * - Programmatic scrolls set a flag to be ignored
 */
export const useAutoScroll = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  messages: Message[],
) => {
  const userHasScrolledRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const isActiveRef = useRef(true);
  
  const numUserMsgs = useMemo(() => getNumUserMsgs(messages), [messages.length]);

  // Reset scroll state when a new user message is added
  useEffect(() => {
    userHasScrolledRef.current = false;
  }, [numUserMsgs]);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || messages.length === 0) return;

    isActiveRef.current = true;

    const scrollToBottom = () => {
      if (!isActiveRef.current || userHasScrolledRef.current) return;

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (!isActiveRef.current || !container || userHasScrolledRef.current) return;
        
        // Mark as programmatic so scroll event ignores this
        isProgrammaticScrollRef.current = true;
        container.scrollTop = container.scrollHeight;
        
        // Clear flag after scroll event has fired
        requestAnimationFrame(() => {
          isProgrammaticScrollRef.current = false;
        });
      });
    };

    // Wheel event: Detect user intent to scroll UP → pause auto-scroll immediately
    const handleWheel = (e: WheelEvent) => {
      if (!isActiveRef.current) return;
      
      if (e.deltaY < 0) {
        // User scrolling UP = pause auto-scroll
        userHasScrolledRef.current = true;
      }
      // Scrolling down is handled by scroll event (check if at bottom)
    };

    // Touch handling for mobile
    let lastTouchY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        lastTouchY = e.touches[0].clientY;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!isActiveRef.current || e.touches.length === 0) return;
      
      const currentY = e.touches[0].clientY;
      const deltaY = lastTouchY - currentY;
      lastTouchY = currentY;
      
      // Swiping up on screen (finger moves up) = content scrolls down = positive deltaY
      // Swiping down on screen (finger moves down) = content scrolls up = negative deltaY
      if (deltaY < -10) {
        // User swiping down = scrolling content UP = pause auto-scroll
        userHasScrolledRef.current = true;
      }
    };

    // Scroll event: Only re-enable auto-scroll when user scrolls to bottom
    const handleScroll = () => {
      if (!isActiveRef.current) return;
      
      // Ignore programmatic scrolls - they shouldn't affect user intent
      if (isProgrammaticScrollRef.current) return;
      
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;

      // User scrolled to bottom → re-enable auto-scroll
      if (distanceFromBottom < 50) {
        userHasScrolledRef.current = false;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('scroll', handleScroll, { passive: true });

    // Initial scroll
    const initialScrollTimeout = setTimeout(scrollToBottom, 0);

    // Throttled ResizeObserver
    let resizeThrottleId: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeThrottleId !== null || !isActiveRef.current) return;
      
      resizeThrottleId = setTimeout(() => {
        resizeThrottleId = null;
        scrollToBottom();
      }, 16);
    });

    if (content) {
      resizeObserver.observe(content);
    } else {
      resizeObserver.observe(container);
    }

    return () => {
      isActiveRef.current = false;
      
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      
      clearTimeout(initialScrollTimeout);
      if (resizeThrottleId !== null) {
        clearTimeout(resizeThrottleId);
      }
      
      resizeObserver.disconnect();
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, contentRef, messages.length]);
};