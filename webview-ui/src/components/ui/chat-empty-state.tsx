import { MessageCircle } from 'lucide-react';

export function ChatEmptyState() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
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
    </div>
  );
}