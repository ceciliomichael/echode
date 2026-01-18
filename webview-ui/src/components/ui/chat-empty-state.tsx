import { useState } from 'react';
import { MessageCircle, CircleCheckBig } from 'lucide-react';
import type { ChatSessionSummary } from '../../types/chat-session';

interface ChatEmptyStateProps {
  recentSessions?: ChatSessionSummary[];
  onLoadSession?: (sessionId: string) => void;
}

export function ChatEmptyState({ recentSessions = [], onLoadSession }: ChatEmptyStateProps) {
  const [nowTime] = useState(() => Date.now());

  const formatTime = (timestamp: number) => {
    const diffMs = nowTime - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
      <div className="text-center space-y-3 px-4">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full border"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            borderColor: 'var(--vscode-panel-border)'
          }}
        >
          <MessageCircle
            size={32}
            strokeWidth={1.5}
            style={{ color: 'var(--vscode-foreground)', opacity: 0.4 }}
          />
        </div>
        <div className="space-y-1">
          <h2
            className="text-base font-medium"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Start a conversation
          </h2>
          <p
            className="text-sm"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            Send a message to begin chatting
          </p>
        </div>
      </div>

      {recentSessions.length > 0 && onLoadSession && (
        <div className="w-full max-w-md mt-8 px-4">
          <div className="flex flex-col gap-1.5">
            {recentSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onLoadSession(session.id)}
                className="group flex items-center justify-between w-full px-3 py-2.5 rounded-xl border transition-colors text-left"
                style={{
                  backgroundColor: 'var(--vscode-input-background)',
                  borderColor: 'var(--vscode-panel-border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-input-background)';
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <CircleCheckBig
                    size={14}
                    className="flex-shrink-0"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                  />
                  <span
                    className="text-sm truncate"
                    style={{ color: 'var(--vscode-foreground)' }}
                  >
                    {session.title}
                  </span>
                </div>
                <span
                  className="text-xs tabular-nums flex-shrink-0 ml-3"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                >
                  {formatTime(session.timestamp)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}