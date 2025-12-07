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
    const isStreamingUpdate = hasNewContent && (isStreaming || isExecutingTool);

    if (currentMessageCount > 0) {
      requestAnimationFrame(() => {
        const nearBottom = isNearBottom();

        // Only follow when auto-scroll is enabled and user is near bottom
        if (isAutoScrollEnabledRef.current && (hasNewMessage || isStreamingUpdate || nearBottom)) {
          scrollToBottom({ behavior: hasNewMessage || !isStreamingUpdate ? 'smooth' : 'auto' });
        }
      });
    }

    lastMessageCountRef.current = currentMessageCount;
    lastMessageKeyRef.current = lastMessageKey;
  }, [messageCount, lastMessageKey, isStreaming, isExecutingTool, isNearBottom, scrollToBottom]);

  return {
    scrollContainerRef,
    isAutoScrollEnabled,
    handleScroll,
    scrollToBottom,
    setIsAutoScrollEnabled,
  };
}
