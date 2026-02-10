import { type FormEvent, type KeyboardEvent, useRef } from 'react';
import { useChatInput } from '../../../hooks/use-chat-input';
import { useDropdownDirection } from '../../../hooks/use-dropdown-direction';
import { useRefactorScan } from '../../../hooks/use-refactor-scan';
import { useWorkflowValidation } from '../../../hooks/use-workflow-validation';
import { buildRefactorMessage } from '../../../utils/message-builders';
import { QueueBlock } from './queue-block';
import { ContextMenu } from '../context-menu';
import { InputWithHighlights } from '../input-with-highlights';
import { AttachmentSection } from './attachment-section';
import { InputToolbar } from './input-toolbar';

import type { ContextUsageResult } from '../../../hooks/use-context-usage';
import type { ChatMode } from '../../../types/chat-mode';
import type { DocumentAttachment } from '../../../utils/document-utils';
import type { ImageAttachment, Message, QueuedMessage } from '../../../types/chat';
import type { Provider } from '../../../types/api-settings';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: ImageAttachment[], overrideMessages?: Message[]) => void;
  onNewChat?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  isExecutingTool?: boolean;
  onStop?: () => void;
  queuedMessages?: QueuedMessage[];
  onRemoveFromQueue?: (id: string) => void;
  onUpdateQueueMessage?: (id: string, content: string, imageAttachments?: ImageAttachment[]) => void;
  onForceSendQueueMessage?: (id: string) => void;
  onClearQueue?: () => void;
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  contextUsage?: ContextUsageResult;
  restoredInput?: string | null;
  restoredAttachments?: DocumentAttachment[] | null;
  restoredImageAttachments?: ImageAttachment[] | null;
  onCompress?: () => void;
  onCancelCompress?: () => void;
  isCompressing?: boolean;
  disableCompress?: boolean;
  subAgentMode?: boolean;
  isSummarizing?: boolean;
}

export function ChatInput({
  onSendMessage,
  onNewChat,
  disabled = false,
  isStreaming = false,
  isExecutingTool = false,
  onStop,
  queuedMessages = [],
  onRemoveFromQueue,
  onUpdateQueueMessage,
  onForceSendQueueMessage,
  onClearQueue,
  mode,
  onModeChange,
  provider,
  model,
  onModelChange,
  contextUsage,
  restoredInput,
  restoredAttachments,
  restoredImageAttachments,
  onCompress,
  onCancelCompress,
  isCompressing = false,
  disableCompress = false,
  subAgentMode = false,
  isSummarizing = false
}: ChatInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownDirection = useDropdownDirection(containerRef);

  // Show stop button only when streaming OR executing a tool (NOT during compression)
  const showStopButton = isStreaming || isExecutingTool;

  // Get refactor scan results
  const { largeFiles, isScanning: isRefactorScanning } = useRefactorScan();

  // Get valid workflow names for slash command validation
  const { validWorkflowNames } = useWorkflowValidation();

  // Use the consolidated chat input hook
  const {
    input,
    textareaRef,
    attachmentHandler,
    contextMenu,
    handleChange,
    handleKeyDown,
    handleSubmit,
    handlePaste,
    handleValueChange,
    handleBlur,
    handleFocus
  } = useChatInput({
    onSendMessage,
    disabled,
    mode,
    restoredInput,
    restoredAttachments,
    restoredImageAttachments
  });

  const handleRefactorRequest = (filePath: string) => {
    // Create a new chat session for the refactor task
    if (onNewChat) {
      onNewChat();
    }

    // Switch to plan mode for refactoring
    if (onModeChange && mode !== 'plan') {
      onModeChange('plan');
    }

    // Delay needed: onNewChat() calls abortAndReset() which sets isStoppingRef=true
    // The flag resets after 100ms, so we must wait before sending
    // Pass empty array as overrideMessages to ensure fresh chat (bypasses stale closure)
    setTimeout(() => {
      const message = buildRefactorMessage(filePath);
      onSendMessage(message, undefined, []);
    }, 150);
  };

  const onFormSubmit = (e: FormEvent) => {
    handleSubmit(e);
  };

  // Wrapper to handle Ctrl+Enter force send when AI is working
  const handleKeyDownWithForceSend = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const isAiWorking = isStreaming || isExecutingTool;
    
    // Ctrl+Enter while AI is working: stop current work, clear queue, and force send immediately
    if (e.key === 'Enter' && !e.shiftKey && (e.ctrlKey || e.metaKey) && isAiWorking) {
      e.preventDefault();
      
      // Only proceed if there's input to send
      if (!input.trim()) return;
      
      // Stop current AI work
      if (onStop) {
        onStop();
      }
      
      // Clear any queued messages
      if (onClearQueue) {
        onClearQueue();
      }
      
      // Wait briefly for stop to take effect, then send normally
      setTimeout(() => {
        handleSubmit(e);
      }, 200);
      
      return;
    }
    
    // Default behavior for other key combinations
    handleKeyDown(e);
  };

  return (
    <div
      className={`relative w-full ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      style={{
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        backgroundColor: 'var(--vscode-sideBar-background)',
        zIndex: 200,
        position: 'relative',
      }}
    >
      {queuedMessages.length > 0 && onRemoveFromQueue && onUpdateQueueMessage && onForceSendQueueMessage && (
        <div className="mb-2" data-edit-outside-ignore="true">
          <QueueBlock
            queuedMessages={queuedMessages}
            onRemove={onRemoveFromQueue}
            onUpdate={onUpdateQueueMessage}
            onForceSend={onForceSendQueueMessage}
            provider={provider}
            model={model}
            mode={mode}
            onModelChange={onModelChange}
          />
        </div>
      )}

      <section
        className="w-full rounded-xl shadow-sm border p-1 transition-colors"
        style={{
          backgroundColor: 'var(--vscode-chat-surface)',
          borderColor: 'var(--vscode-input-border)'
        }}
        aria-label="Chat input area"
      >
        {subAgentMode ? (
          <div className="flex flex-col items-center justify-center py-3 text-sm text-center opacity-80 gap-2">
            <div className="flex items-center gap-2 font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSummarizing ? 'bg-purple-400' : 'bg-blue-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSummarizing ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
              </span>
              {isSummarizing ? 'Summarizing Results...' : 'Sub-Agent Active'}
            </div>
            <div className="text-xs opacity-70 px-4">
              {isSummarizing 
                ? 'Consolidating findings and preparing report...' 
                : 'This agent is running autonomously. It will report back when finished.'}
            </div>
          </div>
        ) : (
          <form onSubmit={onFormSubmit} className="flex flex-col gap-0">
          <input
            ref={attachmentHandler.fileInputRef}
            type="file"
            accept=".sh,.bash,.zsh,.txt,.md,.markdown,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.jsonc,.py,.pyw,.java,.kt,.kts,.cs,.fs,.go,.rs,.cpp,.c,.cc,.cxx,.h,.hpp,.hxx,.rb,.php,.swift,.yaml,.yml,.toml,.ini,.cfg,.conf,.xml,.html,.htm,.css,.scss,.sass,.less,.sql,.r,.lua,.pl,.pm,.env,.gitignore,.dockerignore,.dockerfile,.makefile,.cmake,.gradle,.properties,.log,.csv,text/*,application/json,.jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={attachmentHandler.handleFileChange}
            className="hidden"
            aria-label="Upload files"
          />

          <AttachmentSection
            attachments={attachmentHandler.attachments}
            imageAttachments={attachmentHandler.imageAttachments}
            onRemoveAttachment={attachmentHandler.handleRemoveAttachment}
            onRemoveImageAttachment={attachmentHandler.handleRemoveImageAttachment}
            onAttachmentClick={attachmentHandler.handleAttachmentClick}
            canAddMore={attachmentHandler.canAddMore}
            disabled={disabled}
          />

          <div className="w-full relative rounded-xl" ref={containerRef}>
            {contextMenu.showContextMenu && (
              <ContextMenu
                onSelect={contextMenu.handleMentionSelect}
                searchQuery={contextMenu.searchQuery}
                onMouseDown={(e) => e.preventDefault()}
                selectedIndex={contextMenu.selectedMenuIndex}
                setSelectedIndex={contextMenu.setSelectedMenuIndex}
                selectedType={contextMenu.selectedMenuType}
                dynamicSearchResults={contextMenu.fileSearchResults}
                anchorRef={containerRef}
                direction={dropdownDirection}
              />
            )}
            <InputWithHighlights
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDownWithForceSend}
              onPaste={handlePaste}
              placeholder="Type your message..."
              disabled={disabled}
              rows={1}
              className="w-full px-1.5 py-1 rounded-xl bg-transparent text-sm leading-normal min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 disabled:opacity-50 disabled:cursor-not-allowed placeholder:opacity-50 relative"
              style={{
                color: 'var(--vscode-input-foreground)',
                outline: 'none',
              }}
              onValueChange={handleValueChange}
              onBlur={handleBlur}
              onFocus={handleFocus}
              validWorkflowNames={validWorkflowNames}
              validMentionLabels={contextMenu.mentionPathMap}
            />
          </div>

          <InputToolbar
            onAttachmentClick={attachmentHandler.handleAttachmentClick}
            attachmentCount={attachmentHandler.totalAttachments}
            mode={mode}
            onModeChange={onModeChange}
            provider={provider}
            model={model}
            onModelChange={onModelChange}
            largeFiles={largeFiles}
            isRefactorScanning={isRefactorScanning}
            onRefactorRequest={handleRefactorRequest}
            contextUsage={contextUsage}
            onCompress={onCompress}
            onCancelCompress={onCancelCompress}
            isCompressing={isCompressing}
            disableCompress={disableCompress}
            disabled={disabled}
            showStopButton={showStopButton}
            hasInput={!!input.trim()}
            onStop={() => {
              if (onStop) onStop();
              if (onClearQueue) onClearQueue();
            }}
          />
        </form>
        )}
      </section>
    </div>
  );
}