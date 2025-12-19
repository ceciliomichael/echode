import { useRef, useState, useEffect, useCallback } from 'react';

interface ChatScrollState {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
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
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const lastMessageCountRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const isAutoScrollEnabledRef = useRef(isAutoScrollEnabled);
  const lastMessageKeyRef = useRef(lastMessageKey);
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
    if (!scrollContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    return distanceToBottom <= bottomThresholdPx;
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop } = container;
    const previousScrollTop = lastScrollTopRef.current;
    const isScrollingUp = scrollTop < previousScrollTop;
    const nearBottom = isNearBottom();

    lastScrollTopRef.current = scrollTop;

    if (isScrollingUp) {
      if (isAutoScrollEnabledRef.current) {
        setIsAutoScrollEnabled(false);
      }
      return;
    }

    if (!nearBottom) {
      return;
    }

    if (!isAutoScrollEnabledRef.current) {
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
        // New message: smooth scroll
        scrollToBottom({ behavior: 'smooth' });
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

    const container = scrollContainerRef.current;
    if (!container) return;

    let lastHeight = container.scrollHeight;

    const observer = new ResizeObserver(() => {
      const target = scrollContainerRef.current;
      if (!target) return;

      const { scrollTop, scrollHeight, clientHeight } = target;
      const heightGrew = scrollHeight > lastHeight;
      lastHeight = scrollHeight;

      // Only auto-scroll on height increase (not shrink)
      if (!heightGrew) return;

      const distanceToBottom = scrollHeight - scrollTop - clientHeight;
      const nearBottom = distanceToBottom <= bottomThresholdPx;

      // Scroll if auto-scroll enabled AND (near bottom OR actively streaming/executing)
      if (isAutoScrollEnabledRef.current && nearBottom) {
        scrollToBottom({ behavior: 'auto' });
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [scrollToBottom]);

  return {
    scrollContainerRef,
    isAutoScrollEnabled,
    handleScroll,
    scrollToBottom,
    setIsAutoScrollEnabled,
  };
}
