import { ArrowUp, Clock, Paperclip, Square } from 'lucide-react';
import { ModeDropdown } from '../mode-dropdown';
import { ChatModelSelector } from '../chat-model-selector';
import { ContextIndicator } from '../context-indicator';
import { RefactorIndicator, type LargeFileInfo } from '../refactor-indicator';
import type { ContextUsageResult } from '../../../hooks/use-context-usage';
import type { ChatMode } from '../../../types/chat-mode';
import type { Provider } from '../../../types/api-settings';

interface InputToolbarProps {
  // Attachment
  onAttachmentClick: () => void;
  attachmentCount: number;
  maxAttachments?: number;
  
  // Mode
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  
  // Model
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  
  // Refactor
  largeFiles: LargeFileInfo[];
  isRefactorScanning: boolean;
  onRefactorRequest: (filePath: string) => void;
  
  // Context
  contextUsage?: ContextUsageResult;
  onCompress?: () => void;
  onCancelCompress?: () => void;
  isCompressing?: boolean;
  disableCompress?: boolean;
  
  // State
  disabled?: boolean;
  showStopButton?: boolean;
  hasInput: boolean;
  
  // Actions
  onStop?: () => void;
}

export function InputToolbar({
  onAttachmentClick,
  attachmentCount,
  maxAttachments = 3,
  mode,
  onModeChange,
  provider,
  model,
  onModelChange,
  largeFiles,
  isRefactorScanning,
  onRefactorRequest,
  contextUsage,
  onCompress,
  onCancelCompress,
  isCompressing = false,
  disableCompress = false,
  disabled = false,
  showStopButton = false,
  hasInput,
  onStop
}: InputToolbarProps) {
  const isMaxAttachments = attachmentCount >= maxAttachments;

  return (
    <div className="flex justify-between items-center gap-1 px-1.5 pb-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onAttachmentClick}
          disabled={disabled || isMaxAttachments}
          className="transition-opacity hover:opacity-70 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: 'var(--vscode-foreground)' }}
          title={isMaxAttachments ? `Maximum ${maxAttachments} attachments` : 'Attach documents'}
        >
          <Paperclip className="w-3.5 h-3.5" />
        </button>
        {mode && onModeChange && (
          <ModeDropdown
            mode={mode}
            onModeChange={onModeChange}
            disabled={disabled}
          />
        )}
        <ChatModelSelector
          provider={provider}
          model={model}
          onChange={onModelChange}
          disabled={disabled}
          direction="up"
          showAutodetect={mode === 'yolo'}
        />
      </div>

      <div className="flex items-center gap-1">
        <RefactorIndicator
          largeFiles={largeFiles}
          isScanning={isRefactorScanning}
          disabled={disabled}
          onRefactorRequest={onRefactorRequest}
        />
        {contextUsage && (
          <ContextIndicator
            usage={contextUsage}
            disabled={disabled}
            mode={mode}
            onCompress={onCompress}
            onCancelCompress={onCancelCompress}
            isCompressing={isCompressing}
            disableCompress={disableCompress}
            isStreaming={showStopButton}
          />
        )}
        {/* Stop button: only show when streaming/tool executing AND no input */}
        {showStopButton && !hasInput ? (
          <button
            type="button"
            onClick={onStop}
            className="w-7 h-7 rounded-full transition-opacity hover:opacity-90 flex items-center justify-center"
            style={{
              backgroundColor: '#ffffff',
              color: '#000000'
            }}
            title="Stop generating"
          >
            <Square className="w-3 h-3" fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !hasInput}
            className="w-7 h-7 rounded-full transition-opacity hover:opacity-90 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#ffffff',
              color: '#000000'
            }}
            title={(showStopButton || isCompressing) ? "Add to queue" : "Send message"}
          >
            {/* Show queue icon (Clock) when AI is busy (streaming, tool, or compressing) */}
            {(showStopButton || isCompressing) ? (
              <Clock className="w-3.5 h-3.5" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}