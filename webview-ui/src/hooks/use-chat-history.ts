import { useState, useEffect, useCallback } from 'react';
import type { ChatSessionSummary } from '../types/chat-session';

interface UseChatHistoryReturn {
  sessions: ChatSessionSummary[];
  isLoading: boolean;
  deleteSession: (sessionId: string) => void;
  refreshSessions: () => void;
}

/**
 * Hook to manage chat session history.
 * Centralizes session fetching, listening, and deletion logic.
 * Used by HistoryDropdown and ChatEmptyState.
 */
export function useChatHistory(): UseChatHistoryReturn {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSessions = useCallback(() => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'getAllSessions' });
    }
  }, []);

  useEffect(() => {
    // Fetch sessions on mount
    refreshSessions();

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'sessionsLoaded':
          setSessions(message.sessions || []);
          setIsLoading(false);
          break;
        case 'sessionsUpdated':
          setSessions(message.sessions || []);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshSessions]);

  const deleteSession = useCallback((sessionId: string) => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'deleteSession', sessionId });
    }
  }, []);

  return {
    sessions,
    isLoading,
    deleteSession,
    refreshSessions,
  };
}