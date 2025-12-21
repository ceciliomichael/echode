import { useState } from 'react';
import { X, ChevronDown, ChevronRight, Clock, ImageIcon } from 'lucide-react';
import type { QueuedMessage } from '../../../types/chat';

interface QueueBlockProps {
  queuedMessages: QueuedMessage[];
  onRemove: (id: string) => void;
}

export function QueueBlock({ queuedMessages, onRemove }: QueueBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (queuedMessages.length === 0) return null;

  // Clean up content by removing file attachment blocks for display
  const getDisplayContent = (content: string): string => {
    return content.replace(/<attached_file[^>]*>[\s\S]*?<\/attached_file>/g, '').trim();
  };

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

      {/* Content */}
      {isExpanded && (
        <div className="border-t" style={{ borderColor: 'var(--vscode-input-border)' }}>
          <div className="px-3 py-2 space-y-2 max-h-32 overflow-y-auto">
            {queuedMessages.map((message, index) => (
              <div
                key={message.id}
                className="w-full flex items-start gap-2.5 py-2 px-2.5 rounded-lg group"
                style={{
                  backgroundColor: 'var(--vscode-input-background)',
                }}
              >
                {/* Position number */}
                <div
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-bold mt-0.5"
                  style={{
                    backgroundColor: index === 0 ? 'var(--vscode-charts-blue)' : 'var(--vscode-badge-background)',
                    color: index === 0 ? 'var(--vscode-editor-background)' : 'var(--vscode-badge-foreground)',
                  }}
                >
                  {index + 1}
                </div>

                {/* Message content - full display */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm leading-relaxed break-words"
                    style={{ color: 'var(--vscode-input-foreground)' }}
                  >
                    {getDisplayContent(message.content)}
                  </p>
                  
                  {/* Image attachments indicator */}
                  {message.imageAttachments && message.imageAttachments.length > 0 && (
                    <div 
                      className="flex items-center gap-1 mt-1.5"
                      style={{ color: 'var(--vscode-descriptionForeground)' }}
                    >
                      <ImageIcon className="w-3 h-3" />
                      <span className="text-xs">
                        {message.imageAttachments.length} image{message.imageAttachments.length > 1 ? 's' : ''} attached
                      </span>
                    </div>
                  )}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(message.id);
                  }}
                  className="flex-shrink-0 p-1 rounded-md transition-opacity opacity-40 hover:opacity-100"
                  style={{ color: 'var(--vscode-descriptionForeground)' }}
                  title="Remove from queue"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}