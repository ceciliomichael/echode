import { useState, useEffect, useCallback } from 'react';

interface ExtensionMessagesState {
  isHistoryOpen: boolean;
  echoSearchEnabled: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  closeHistory: () => void;
}

interface ExtensionMessagesConfig {
  onNewChat: () => void;
  onSessionLoaded: (session: { uiState?: { editingMessageId?: string; revertPreviewMessageId?: string } }) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  setIsAutoScrollEnabled: (enabled: boolean) => void;
}

export function useExtensionMessages(config: ExtensionMessagesConfig): ExtensionMessagesState {
  const { onNewChat, onSessionLoaded, scrollContainerRef, setIsAutoScrollEnabled } = config;
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [echoSearchEnabled, setEchoSearchEnabled] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem('echode_settings');
        if (stored) {
          const settings = JSON.parse(stored);
          return settings?.indexingSettings?.enabled ?? true;
        }
      } catch {
        // Ignore parse errors
      }
    }
    return true;
  });

  const closeHistory = useCallback(() => {
    setIsHistoryOpen(false);
    if (window.vscode) {
      window.vscode.postMessage({ type: 'historyPanelClosed' });
    }
  }, []);

  // Listen for settings changes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'settingsSaved') {
        const settings = message.settings;
        setEchoSearchEnabled(settings?.indexingSettings?.enabled ?? true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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
          const sessionUiState = message.session?.uiState;
          const hasActiveEdit = sessionUiState?.editingMessageId || sessionUiState?.revertPreviewMessageId;
          
          if (hasActiveEdit) {
            setIsAutoScrollEnabled(false);
            onSessionLoaded(message.session);
            return;
          }
          
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
          setIsAutoScrollEnabled(true);
          onSessionLoaded(message.session);
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onNewChat, onSessionLoaded, scrollContainerRef, setIsAutoScrollEnabled]);

  return {
    isHistoryOpen,
    echoSearchEnabled,
    setIsHistoryOpen,
    closeHistory,
  };
}
