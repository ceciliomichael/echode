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
  isStreaming: boolean,
  isExecutingTool: boolean
): ChatScrollState {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const lastMessageCountRef = useRef(0);
  const lastScrollTopRef = useRef(0);
  const isAutoScrollEnabledRef = useRef(isAutoScrollEnabled);

  // Keep ref in sync with state
  useEffect(() => {
    isAutoScrollEnabledRef.current = isAutoScrollEnabled;
  }, [isAutoScrollEnabled]);

  const scrollToBottom = useCallback((options?: { behavior?: 'auto' | 'smooth' }) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: options?.behavior || 'smooth'
      });
    }
  }, []);

  const isNearBottom = useCallback(() => {
    if (!scrollContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    return distanceToBottom < 40;
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop } = container;
    const previousScrollTop = lastScrollTopRef.current;
    const isScrollingUp = scrollTop < previousScrollTop;

    lastScrollTopRef.current = scrollTop;

    if (isScrollingUp) {
      if (isAutoScrollEnabled) {
        setIsAutoScrollEnabled(false);
      }
      return;
    }

    if (isNearBottom()) {
      if (!isAutoScrollEnabled) {
        setIsAutoScrollEnabled(true);
      }
    }
  }, [isAutoScrollEnabled, isNearBottom]);

  // Auto-scroll when messages change
  useEffect(() => {
    const currentMessageCount = messageCount;
    const previousMessageCount = lastMessageCountRef.current;
    const hasNewMessage = currentMessageCount > previousMessageCount;
    const isStreamingUpdate =
      currentMessageCount === previousMessageCount && (isStreaming || isExecutingTool);

    if (currentMessageCount > 0) {
      requestAnimationFrame(() => {
        if (!isAutoScrollEnabledRef.current) return;
        if (!isNearBottom()) return;
        scrollToBottom({ behavior: hasNewMessage || !isStreamingUpdate ? 'smooth' : 'auto' });
      });
    }

    lastMessageCountRef.current = currentMessageCount;
  }, [messageCount, isStreaming, isExecutingTool, isNearBottom, scrollToBottom]);

  return {
    scrollContainerRef,
    isAutoScrollEnabled,
    handleScroll,
    scrollToBottom,
    setIsAutoScrollEnabled,
  };
}
