import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import type { QueuedMessage, ImageAttachment } from '../../../types/chat';
import type { ChatMode } from '../../../types/chat-mode';
import type { Provider } from '../../../types/api-settings';
import { QueueItem } from './queue-item';

interface QueueBlockProps {
  queuedMessages: QueuedMessage[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, content: string, imageAttachments?: ImageAttachment[]) => void;
  onForceSend: (id: string) => void;
  provider: Provider;
  model: string;
  mode?: ChatMode;
  onModelChange: (provider: Provider, model: string) => void;
}

export function QueueBlock({
  queuedMessages,
  onRemove,
  onUpdate,
  onForceSend,
  provider,
  model,
  mode,
  onModelChange,
}: QueueBlockProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (queuedMessages.length === 0) return null;

  return (
    <div
      className="w-full rounded-xl border"
      style={{
        backgroundColor: 'var(--vscode-editor-background)',
        borderColor: 'var(--vscode-input-border)',
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 transition-opacity hover:opacity-90 rounded-t-xl"
        style={{
          backgroundColor: 'transparent',
          outline: 'none',
        }}
      >
        <div className="flex items-center gap-2">
          <Clock
            className="w-3.5 h-3.5"
            style={{ color: 'var(--vscode-charts-blue)' }}
          />
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--vscode-input-foreground)' }}
          >
            Queued
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-md font-medium"
            style={{ 
              backgroundColor: 'var(--vscode-badge-background)',
              color: 'var(--vscode-badge-foreground)' 
            }}
          >
            {queuedMessages.length}
          </span>
        </div>
        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      {/* Content - Queue Items */}
      {isExpanded && (
        <div className="border-t" style={{ borderColor: 'var(--vscode-input-border)' }}>
          <div className="px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
            {queuedMessages.map((message, index) => (
              <QueueItem
                key={message.id}
                message={message}
                index={index}
                onUpdate={onUpdate}
                onRemove={onRemove}
                onForceSend={onForceSend}
                provider={provider}
                model={model}
                mode={mode}
                onModelChange={onModelChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}