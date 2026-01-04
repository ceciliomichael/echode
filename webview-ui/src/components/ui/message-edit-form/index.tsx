import type { FormEvent } from 'react';
import { useMessageEditForm } from '../../../hooks/use-message-edit-form';
import { ContextMenu } from '../context-menu';
import { InputWithHighlights } from '../input-with-highlights';
import { EditFormAttachmentSection } from './edit-form-attachment-section';
import { EditFormToolbar } from './edit-form-toolbar';

import type { ChatMode } from '../../../types/chat-mode';
import type { ContextUsageResult } from '../../../hooks/use-context-usage';
import type { DocumentAttachment } from '../../../utils/document-utils';
import type { Provider } from '../../../types/api-settings';
import type { ImageAttachment } from '../../../types/chat';

// File accept string for attachment input
const FILE_ACCEPT = '.sh,.bash,.zsh,.txt,.md,.markdown,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.jsonc,.py,.pyw,.java,.kt,.kts,.cs,.fs,.go,.rs,.cpp,.c,.cc,.cxx,.h,.hpp,.hxx,.rb,.php,.swift,.yaml,.yml,.toml,.ini,.cfg,.conf,.xml,.html,.htm,.css,.scss,.sass,.less,.sql,.r,.lua,.pl,.pm,.env,.gitignore,.dockerignore,.dockerfile,.makefile,.cmake,.gradle,.properties,.log,.csv,text/*,application/json,.jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp';

interface MessageEditFormProps {
  initialContent: string;
  onSubmit: (content: string, imageAttachments?: ImageAttachment[], forceEchoSearch?: boolean) => void;
  onCancel: () => void;
  onSave?: (content: string) => void;
  attachments?: DocumentAttachment[];
  imageAttachments?: ImageAttachment[];
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  contextUsage?: ContextUsageResult;
}

export function MessageEditForm({
  initialContent,
  onSubmit,
  onCancel,
  onSave,
  attachments,
  imageAttachments,
  mode,
  onModeChange,
  provider,
  model,
  onModelChange,
  contextUsage
}: MessageEditFormProps) {
  const {
    editContent,
    textareaRef,
    containerRef,
    dropdownDirection,
    attachmentHandler,
    contextMenu,
    handleChange,
    handleKeyDown,
    handleSubmit,
    handlePaste,
    handleValueChange
  } = useMessageEditForm({
    initialContent,
    initialAttachments: attachments,
    initialImageAttachments: imageAttachments,
    onSubmit,
    onCancel,
    onSave,
    mode
  });

  const onFormSubmit = (e: FormEvent) => {
    handleSubmit(e);
  };

  return (
    <div ref={containerRef} className="relative z-[60]">
      <section
        className="w-full rounded-xl shadow-sm border p-1 transition-colors"
        style={{
          backgroundColor: 'var(--vscode-chat-surface)',
          borderColor: 'var(--vscode-input-border)'
        }}
        aria-label="Chat input area"
      >
        <form onSubmit={onFormSubmit} className="flex flex-col gap-0">
          <input
            ref={attachmentHandler.fileInputRef}
            type="file"
            accept={FILE_ACCEPT}
            multiple
            onChange={attachmentHandler.handleFileChange}
            className="hidden"
            aria-label="Upload files"
          />

          <EditFormAttachmentSection
            attachments={attachmentHandler.attachments}
            imageAttachments={attachmentHandler.imageAttachments}
            onRemoveAttachment={attachmentHandler.handleRemoveAttachment}
            onRemoveImageAttachment={attachmentHandler.handleRemoveImageAttachment}
            onAttachmentClick={attachmentHandler.handleAttachmentClick}
            canAddMore={attachmentHandler.canAddMore}
          />

          <div className="w-full relative rounded-xl">
            {contextMenu.showContextMenu && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1">
                <ContextMenu
                  onSelect={contextMenu.handleMentionSelect}
                  searchQuery={contextMenu.searchQuery}
                  onMouseDown={(e) => e.preventDefault()}
                  selectedIndex={contextMenu.selectedMenuIndex}
                  setSelectedIndex={contextMenu.setSelectedMenuIndex}
                  selectedType={contextMenu.selectedMenuType}
                  dynamicSearchResults={contextMenu.fileSearchResults}
                />
              </div>
            )}
            <InputWithHighlights
              ref={textareaRef}
              value={editContent}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type your message..."
              rows={1}
              maxHeight={100}
              className="w-full px-1.5 py-1 rounded-xl bg-transparent text-sm leading-normal min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 relative"
              style={{
                color: 'var(--vscode-input-foreground)',
                outline: 'none',
              }}
              onValueChange={handleValueChange}
            />
          </div>

          <EditFormToolbar
            onAttachmentClick={attachmentHandler.handleAttachmentClick}
            attachmentCount={attachmentHandler.totalAttachments}
            mode={mode}
            onModeChange={onModeChange}
            provider={provider}
            model={model}
            onModelChange={onModelChange}
            dropdownDirection={dropdownDirection}
            contextUsage={contextUsage}
            hasContent={!!editContent.trim()}
          />
        </form>
      </section>
    </div>
  );
}