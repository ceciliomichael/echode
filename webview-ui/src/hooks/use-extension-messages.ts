import { useState, useEffect, useCallback } from 'react';

interface ExtensionMessagesState {
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  closeHistory: () => void;
}

interface ExtensionMessagesConfig {
  onNewChat: () => void;
  onSessionLoaded: (session: { uiState?: { editingMessageId?: string; revertPreviewMessageId?: string } }) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function useExtensionMessages(config: ExtensionMessagesConfig): ExtensionMessagesState {
  const { onNewChat, onSessionLoaded, scrollContainerRef } = config;
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const closeHistory = useCallback(() => {
    setIsHistoryOpen(false);
    if (window.vscode) {
      window.vscode.postMessage({ type: 'historyPanelClosed' });
    }
  }, []);

  // Listen for extension commands
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'newChat') {
        onNewChat();
      } else if (message.type === 'openHistory') {
        setIsHistoryOpen(true);
      } else if (message.type === 'closeHistory') {
        setIsHistoryOpen(false);
      } else if (message.type === 'sessionLoaded') {
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
          onSessionLoaded(message.session);
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onNewChat, onSessionLoaded, scrollContainerRef]);

  return {
    isHistoryOpen,
    setIsHistoryOpen,
    closeHistory,
  };
}
