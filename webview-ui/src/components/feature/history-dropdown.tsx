import { useState, useEffect } from 'react';
import type { ChatSessionSummary } from '../../types/chat-session';
import { Clock, Trash2 } from 'lucide-react';

interface HistoryDropdownProps {
  onLoadSession: (sessionId: string) => void;
  onClose: () => void;
}

export function HistoryDropdown({ onLoadSession, onClose }: HistoryDropdownProps) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (window.vscode) {
      window.vscode.postMessage({ type: 'getAllSessions' });
    }

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
  }, []);

  const handleLoadSession = (sessionId: string) => {
    onLoadSession(sessionId);
    onClose();
  };

  const handleDeleteSession = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.vscode) {
      window.vscode.postMessage({ type: 'deleteSession', sessionId });
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex flex-col max-h-96">
      {/* Header */}
      <div 
        className="px-3 py-2 border-b text-xs font-medium"
        style={{ 
          borderColor: 'var(--vscode-dropdown-border)',
          color: 'var(--vscode-descriptionForeground)'
        }}
      >
        Recent Conversations ({sessions.length})
      </div>

      {/* List */}
      <div className="overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            Loading...
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            No history yet
          </div>
        ) : (
          sessions.slice(0, 10).map((session) => (
            <div
              key={session.id}
              onClick={() => handleLoadSession(session.id)}
              className="px-3 py-2 cursor-pointer transition-colors border-b"
              style={{
                borderColor: 'var(--vscode-dropdown-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate mb-0.5" style={{ color: 'var(--vscode-foreground)' }}>
                    {session.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                    <div className="flex items-center gap-1">
                      <Clock size={10} />
                      <span>{formatDate(session.timestamp)}</span>
                    </div>
                    <span>·</span>
                    <span>{session.messageCount} msgs</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="p-1 rounded transition-colors flex-shrink-0"
                  style={{
                    color: 'var(--vscode-descriptionForeground)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground)';
                    e.currentTarget.style.color = 'var(--vscode-errorForeground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
                  }}
                  aria-label="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
