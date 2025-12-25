import { useRef, useState, useEffect, useCallback } from 'react';

interface ChatScrollState {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollContentRef: React.RefObject<HTMLDivElement | null>;
  isAutoScrollEnabled: boolean;
  handleScroll: () => void;
  scrollToBottom: (options?: { behavior?: 'auto' | 'smooth' }) => void;
  setIsAutoScrollEnabled: (enabled: boolean) => void;
}

export function useChatScroll(
  messageCount: number,
  _lastMessageKey: string,
  _isStreaming: boolean,
  _isExecutingTool: boolean
): ChatScrollState {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  
  // userHasScrolled is true if the user has manually scrolled up away from the bottom.
  // It is false if the user is at the bottom or a new message has arrived.
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  
  // Use a ref to access the latest state inside the ResizeObserver callback
  // without needing to re-create the observer on every state change.
  const userHasScrolledRef = useRef(false);
  // Track last scroll metrics to distinguish user scrolls from content growth
  const lastScrollHeightRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  
  useEffect(() => {
    userHasScrolledRef.current = userHasScrolled;
  }, [userHasScrolled]);

  const scrollToBottom = useCallback((_options?: { behavior?: 'auto' | 'smooth' }) => {
    const elem = scrollContainerRef.current;
    if (elem) {
      // Always use 'auto' (instant) scrolling to prevent race conditions with the 
      // "sticky" logic. Smooth scrolling causes intermediate states where we are 
      // not at the bottom, which falsely triggers userHasScrolled = true.
      elem.scrollTo({
        top: elem.scrollHeight,
        behavior: 'auto'
      });
      // When programmatically scrolling to bottom, we consider the user "caught up"
      setUserHasScrolled(false);
      // Update refs to prevent handleScroll from thinking this was a user scroll
      lastScrollTopRef.current = elem.scrollHeight;
      lastScrollHeightRef.current = elem.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const elem = scrollContainerRef.current;
    if (!elem) return;

    const { scrollTop, scrollHeight, clientHeight } = elem;
    const lastScrollHeight = lastScrollHeightRef.current;
    const lastScrollTop = lastScrollTopRef.current;

    // Update refs immediately for next event
    lastScrollHeightRef.current = scrollHeight;
    lastScrollTopRef.current = scrollTop;

    // Check if we are at the bottom (with a small tolerance)
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    
    // Case 1: We are at the bottom. User is definitely caught up.
    if (isAtBottom) {
      setUserHasScrolled(false);
      return;
    }

    // Case 2: Content grew (and we aren't at bottom yet).
    // This happens when new tokens arrive but ResizeObserver hasn't scrolled us down yet.
    // We should NOT disable auto-scroll in this case.
    if (scrollHeight > lastScrollHeight) {
      return;
    }

    // Case 3: User scrolled UP.
    // Only disable auto-scroll if the user explicitly moved the scrollbar UP.
    // (Or if they are sitting in the middle of the chat while content is static).
    if (scrollTop < lastScrollTop) {
      setUserHasScrolled(true);
    }
  }, []);

  // Reset scroll state when a new message is added.
  // This ensures that new messages always trigger a scroll to bottom,
  // overriding any previous manual scroll position.
  useEffect(() => {
    setUserHasScrolled(false);
    // Force an immediate scroll to bottom to ensure we start in the correct position.
    // This helps handle race conditions where layout updates might happen before the observer fires.
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messageCount]);

  // Use ResizeObserver to keep the view pinned to the bottom when content grows
  // (e.g. streaming tokens, tool outputs, or new messages).
  // This only happens if the user hasn't manually scrolled up.
  useEffect(() => {
    const elem = scrollContainerRef.current;
    if (!elem) return;

    const observer = new ResizeObserver(() => {
      // If user hasn't scrolled up, keep pinned to bottom
      if (!userHasScrolledRef.current && elem) {
        elem.scrollTop = elem.scrollHeight;
      }
    });

    observer.observe(elem);
    
    // Also observe the content wrapper if it exists, as height changes often happen there
    // (React sometimes updates children without changing container properties immediately)
    if (scrollContentRef.current) {
      observer.observe(scrollContentRef.current);
    }

    return () => observer.disconnect();
  }, [messageCount]);

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