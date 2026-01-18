import { useState, useMemo } from 'react';
import { Search, ClipboardList, CircleCheckBig, Loader2, Trash2 } from 'lucide-react';
import { useChatHistory } from '../../hooks/use-chat-history';

interface HistoryDropdownProps {
  onLoadSession: (sessionId: string) => void;
  onClose: () => void;
}

export function HistoryDropdown({ onLoadSession, onClose }: HistoryDropdownProps) {
  const { sessions, isLoading, deleteSession } = useChatHistory();
  const [searchQuery, setSearchQuery] = useState('');
  const [nowTime] = useState(() => Date.now());

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(session => 
      session.title.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  const handleLoadSession = (sessionId: string) => {
    onLoadSession(sessionId);
    onClose();
  };

  const handleDeleteSession = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    deleteSession(sessionId);
  };

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
    <div className="flex flex-col max-h-96">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2.5"
        style={{ 
          borderBottom: '1px solid var(--vscode-widget-border, var(--vscode-dropdown-border))',
        }}
      >
        <div className="flex items-center gap-2">
          <ClipboardList 
            size={14} 
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          />
          <span 
            className="text-sm font-medium"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Chat History
          </span>
        </div>
      </div>

      {/* Search */}
      <div 
        className="px-3 py-2"
        style={{ 
          borderBottom: '1px solid var(--vscode-widget-border, var(--vscode-dropdown-border))',
        }}
      >
        <div 
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
          style={{ 
            backgroundColor: 'var(--vscode-input-background)',
            border: '1px solid var(--vscode-input-border, var(--vscode-dropdown-border))',
          }}
        >
          <Search size={14} style={{ color: 'var(--vscode-descriptionForeground)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-xs"
            style={{ 
              color: 'var(--vscode-input-foreground)',
              border: 'none',
            }}
          />
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div 
            className="flex items-center justify-center py-8"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div 
            className="px-3 py-8 text-center text-xs"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            {searchQuery ? 'No matching conversations' : 'No history yet'}
          </div>
        ) : (
          filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleLoadSession(session.id)}
                className="group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-list-hoverBackground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
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
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--vscode-errorForeground)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--vscode-descriptionForeground)';
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                  <span 
                    className="text-xs tabular-nums"
                    style={{ color: 'var(--vscode-descriptionForeground)' }}
                  >
                    {formatTime(session.timestamp)}
                  </span>
                </div>
              </div>
          ))
        )}
      </div>
    </div>
  );
}
