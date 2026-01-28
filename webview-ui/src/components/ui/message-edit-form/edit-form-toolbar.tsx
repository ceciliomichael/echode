import { ArrowUp, Check, Paperclip } from 'lucide-react';
import { ModeDropdown } from '../mode-dropdown';
import { ChatModelSelector } from '../chat-model-selector';
import { ContextIndicator } from '../context-indicator';
import type { ChatMode } from '../../../types/chat-mode';
import type { Provider } from '../../../types/api-settings';
import type { ContextUsageResult } from '../../../hooks/use-context-usage';

interface EditFormToolbarProps {
  onAttachmentClick: () => void;
  attachmentCount: number;
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  dropdownDirection: 'up' | 'down';
  contextUsage?: ContextUsageResult;
  hasContent: boolean;
  isSaveMode?: boolean;
}

export function EditFormToolbar({
  onAttachmentClick,
  attachmentCount,
  mode,
  onModeChange,
  provider,
  model,
  onModelChange,
  dropdownDirection,
  contextUsage,
  hasContent,
  isSaveMode = false
}: EditFormToolbarProps) {
  const maxAttachments = 3;
  const isAttachmentDisabled = attachmentCount >= maxAttachments;

  return (
    <div className="flex justify-between items-center gap-1 px-1.5 pb-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onAttachmentClick}
          disabled={isAttachmentDisabled}
          className="transition-opacity hover:opacity-70 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: 'var(--vscode-foreground)' }}
          title={isAttachmentDisabled ? 'Maximum 3 attachments' : 'Attach files'}
        >
          <Paperclip className="w-3.5 h-3.5" />
        </button>
        {!isSaveMode && mode && onModeChange && (
          <ModeDropdown
            mode={mode}
            onModeChange={onModeChange}
            disabled={false}
            direction={dropdownDirection}
          />
        )}
        {!isSaveMode && (
          <ChatModelSelector
            provider={provider}
            model={model}
            onChange={onModelChange}
            disabled={false}
            direction={dropdownDirection}
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        {contextUsage && (
          <ContextIndicator
            usage={contextUsage}
            disabled={false}
            mode={mode}
          />
        )}
        <button
          type="submit"
          disabled={!hasContent}
          className="w-7 h-7 rounded-full transition-opacity hover:opacity-90 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: '#ffffff',
            color: '#000000'
          }}
          title={isSaveMode ? 'Save changes' : 'Send message'}
        >
          {isSaveMode ? <Check className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}