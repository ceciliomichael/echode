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
  lastMessageKey: string,
  isStreaming: boolean,
  isExecutingTool: boolean
): ChatScrollState {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const lastMessageCountRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const isAutoScrollEnabledRef = useRef(isAutoScrollEnabled);
  const lastMessageKeyRef = useRef(lastMessageKey);
  // Track last known scrollHeight to detect content growth
  const lastScrollHeightRef = useRef(0);
  // Cooldown period after content grows to ignore scroll events
  const contentGrowthCooldownRef = useRef(false);
  const bottomThresholdPx = 64;

  const scrollToBottom = useCallback((options?: { behavior?: 'auto' | 'smooth' }) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: options?.behavior || 'smooth'
      });
    }
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    isAutoScrollEnabledRef.current = isAutoScrollEnabled;
  }, [isAutoScrollEnabled]);

  // Ensure we start pinned to bottom on mount when enabled
  useEffect(() => {
    if (isAutoScrollEnabledRef.current) {
      requestAnimationFrame(() => scrollToBottom({ behavior: 'auto' }));
    }
  }, [scrollToBottom]);

  const isNearBottom = useCallback(() => {
    if (!scrollContainerRef.current) {return false;}
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    return distanceToBottom <= bottomThresholdPx;
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {return;}

    const { scrollTop, scrollHeight } = container;
    const previousScrollTop = lastScrollTopRef.current;
    const previousScrollHeight = lastScrollHeightRef.current;
    const nearBottom = isNearBottom();

    // Detect if content just grew (big chunk added)
    const contentJustGrew = scrollHeight > previousScrollHeight;
    
    // Update refs
    lastScrollTopRef.current = scrollTop;
    lastScrollHeightRef.current = scrollHeight;

    // If content just grew and we were auto-scrolling, set a brief cooldown
    // to ignore scroll events that might be triggered by the layout shift
    if (contentJustGrew && isAutoScrollEnabledRef.current) {
      contentGrowthCooldownRef.current = true;
      // Clear cooldown after a brief moment (allows layout to settle)
      setTimeout(() => {
        contentGrowthCooldownRef.current = false;
      }, 50);
      return;
    }

    // During cooldown, ignore scroll events (they're likely from content growth)
    if (contentGrowthCooldownRef.current) {
      return;
    }

    // Calculate scroll delta - use a threshold to filter out micro-movements
    // and browser jitter that shouldn't disable auto-scroll
    const scrollDelta = previousScrollTop - scrollTop;
    const scrollUpThreshold = 5; // pixels - must scroll up at least this much to disable
    const isIntentionalScrollUp = scrollDelta > scrollUpThreshold;

    // Only disable auto-scroll for intentional upward scrolling
    if (isIntentionalScrollUp) {
      if (isAutoScrollEnabledRef.current) {
        setIsAutoScrollEnabled(false);
      }
      return;
    }

    // Re-enable auto-scroll when user scrolls back to bottom
    if (nearBottom && !isAutoScrollEnabledRef.current) {
      setIsAutoScrollEnabled(true);
    }
  }, [isNearBottom]);

  // Auto-scroll when messages or streamed content change
  useEffect(() => {
    const currentMessageCount = messageCount;
    const previousMessageCount = lastMessageCountRef.current;
    const hasNewMessage = currentMessageCount > previousMessageCount;
    const hasNewContent = lastMessageKey !== lastMessageKeyRef.current;

    // When auto-scroll is enabled, always pin to the bottom on new messages
    // and while streaming content (including loading dots)
    if (isAutoScrollEnabledRef.current && currentMessageCount > 0) {
      if (hasNewMessage) {
        const isBulkLoad = currentMessageCount - previousMessageCount > 1 || previousMessageCount === 0;
        // If loading history (bulk) or initial load, scroll instantly.
        // Otherwise (single new message), scroll smoothly.
        scrollToBottom({ behavior: isBulkLoad ? 'auto' : 'smooth' });
      } else if (hasNewContent && (isStreaming || isExecutingTool)) {
        // Streaming update: instant scroll to keep up with fast content
        scrollToBottom({ behavior: 'auto' });
      }
    }

    lastMessageCountRef.current = currentMessageCount;
    lastMessageKeyRef.current = lastMessageKey;
  }, [messageCount, lastMessageKey, isStreaming, isExecutingTool, scrollToBottom]);

  // Keep pinned to bottom when content height changes while user is at bottom.
  // This covers tool output and tool expansion (isExpanded) that add extra
  // vertical space without changing message content.
  useEffect(() => {
    // Guard for environments without ResizeObserver (should be present in VS Code webview)
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    // Observe the content wrapper, not the container, to detect size changes
    const content = scrollContentRef.current;
    if (!content) {return;}

    let lastHeight = content.scrollHeight;

    const observer = new ResizeObserver(() => {
      const target = scrollContentRef.current;
      if (!target) {return;}

      const { scrollHeight } = target;
      const heightGrew = scrollHeight > lastHeight;
      lastHeight = scrollHeight;

      // Only auto-scroll on height increase (not shrink)
      if (!heightGrew) {return;}

      // If auto-scroll is enabled (user hasn't manually scrolled up),
      // we must stay pinned to bottom even if a large chunk makes 'nearBottom' false temporarily.
      if (isAutoScrollEnabledRef.current) {
        scrollToBottom({ behavior: 'auto' });
      }
    });

    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, [scrollToBottom]);

  return {
    scrollContainerRef,
    scrollContentRef,
    isAutoScrollEnabled,
    handleScroll,
    scrollToBottom,
    setIsAutoScrollEnabled,
  };
}
