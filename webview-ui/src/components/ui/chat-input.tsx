import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { usePasteHandler } from '../../hooks/use-paste-handler';
import { useFileMention } from '../../hooks/use-file-mention';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { ArrowUp, Paperclip, Square } from 'lucide-react';

import { TodoBlock } from './todo-block';
import { AttachmentPreview } from './attachment-preview';
import { ImageAttachmentPreview } from './image-attachment-preview';
import { FileMentionMenu } from './file-mention-menu';

import { ModeDropdown } from './mode-dropdown';
import { ChatModelSelector } from './chat-model-selector';
import { ContextIndicator } from './context-indicator';
import { RefactorIndicator } from './refactor-indicator';
import { useRefactorScan } from '../../hooks/use-refactor-scan';
import type { ContextUsageResult } from '../../hooks/use-context-usage';

import { buildRefactorMessage } from '../../utils/message-builders';
import { buildHighlightedSegments, MENTION_HIGHLIGHT_STYLE } from '../../utils/mention-highlighter';
import type { TodoTask } from '../../types/todo';
import type { ChatMode } from '../../types/chat-mode';
import { processDocumentFiles, buildAllAttachedFileBlocks, validateDocumentFile, type DocumentAttachment } from '../../utils/document-utils';
import { validateImageFile, processImageFiles } from '../../utils/image-utils';
import type { ImageAttachment, Message } from '../../types/chat';
import type { Provider } from '../../types/api-settings';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: ImageAttachment[], forceEchoSearch?: boolean, overrideMessages?: Message[]) => void;
  onNewChat?: () => void;

  disabled?: boolean;
  isStreaming?: boolean;
  isExecutingTool?: boolean;
  isCompressing?: boolean;
  onStop?: () => void;
  todos?: TodoTask[];
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  contextUsage?: ContextUsageResult;
  restoredInput?: string | null;
  restoredAttachments?: DocumentAttachment[] | null;
  restoredImageAttachments?: ImageAttachment[] | null;
}

export function ChatInput({ onSendMessage, onNewChat, disabled = false, isStreaming = false, isExecutingTool = false, isCompressing = false, onStop, todos = [], mode, onModeChange, provider, model, onModelChange, contextUsage, restoredInput, restoredAttachments, restoredImageAttachments }: ChatInputProps) {
  // Show stop button when streaming OR executing a tool (like echo_search)
  const showStopButton = isStreaming || isExecutingTool;

  const [input, setInput] = useState(restoredInput ?? '');
  const [attachments, setAttachments] = useState<DocumentAttachment[]>(restoredAttachments ?? []);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>(restoredImageAttachments ?? []);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get refactor scan results
  const { largeFiles, isScanning: isRefactorScanning } = useRefactorScan();

  // Get workspace context for file list
  const workspace = useWorkspaceContext();
  const workspaceFiles = workspace?.files ?? [];

  // File mention autocomplete
  const {
    suggestionState,
    filteredFiles,
    mentions,
    handleKeyDown: handleMentionKeyDown,
    handleChange: handleMentionChange,
    selectFile,
    closeSuggestions,
    setTextareaRef: setMentionTextareaRef,
  } = useFileMention({
    value: input,
    onChange: setInput,
    files: workspaceFiles,
    disabled: disabled || isStreaming,
  });

  const { handlePaste } = usePasteHandler({
    attachments,
    setAttachments,
    imageAttachments,
    setImageAttachments,
    disabled: disabled || isStreaming
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Only expand beyond initial row if there's content
      if (input) {
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }
  }, [input]);

  const handleSubmit = (e: FormEvent, forceEchoSearch: boolean = false) => {
    e.preventDefault();
    const content = input;
    // Only use trim() to check for non-empty content, but send the original text
    if (content.trim() && !disabled) {
      // Build <attached_file> blocks and append to message content
      const attachmentBlocks = buildAllAttachedFileBlocks(attachments);
      const contentWithAttachments = content + attachmentBlocks;

      onSendMessage(
        contentWithAttachments,
        imageAttachments,
        forceEchoSearch
      );

      setInput('');
      setAttachments([]);
      setImageAttachments([]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    handleMentionChange(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Let file mention handle keyboard navigation first
    if (handleMentionKeyDown(e)) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      // Ctrl+Enter: force echo_search for Agent, Plan, and Ask modes
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSubmit(e, mode === 'agent' || mode === 'plan' || mode === 'ask');
        return;
      }

      // Regular Enter: normal send
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 3 - (attachments.length + imageAttachments.length);
    if (remainingSlots <= 0) return;

    // Separate files into documents and images
    const filesArray = Array.from(files);
    const docFiles: File[] = [];
    const imgFiles: File[] = [];

    for (const file of filesArray) {
      if (validateDocumentFile(file).valid) {
        docFiles.push(file);
      } else if (validateImageFile(file).valid) {
        imgFiles.push(file);
      }
    }

    // Process document files first
    let usedSlots = 0;
    if (docFiles.length > 0) {
      const docFileList = createFileList(docFiles);
      const { attachments: newDocAttachments, errors: docErrors } = await processDocumentFiles(docFileList, remainingSlots);
      if (docErrors.length > 0) {
        console.error('Document processing errors:', docErrors);
      }
      if (newDocAttachments.length > 0) {
        setAttachments(prev => [...prev, ...newDocAttachments]);
        usedSlots += newDocAttachments.length;
      }
    }

    // Process image files with remaining slots
    const remainingAfterDocs = remainingSlots - usedSlots;
    if (imgFiles.length > 0 && remainingAfterDocs > 0) {
      const imgFileList = createFileList(imgFiles);
      const { attachments: newImgAttachments, errors: imgErrors } = await processImageFiles(imgFileList, remainingAfterDocs);
      if (imgErrors.length > 0) {
        console.error('Image processing errors:', imgErrors);
      }
      if (newImgAttachments.length > 0) {
        setImageAttachments(prev => [...prev, ...newImgAttachments]);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper to create a FileList-like object from File array
  const createFileList = (files: File[]): FileList => {
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    return dataTransfer.files;
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveImageAttachment = (index: number) => {
    setImageAttachments(prev => prev.filter((_, i) => i !== index));
  };



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
      onSendMessage(message, undefined, false, []);
    }, 150);
  };

  return (
    <div
      className="relative w-full"
      data-edit-outside-ignore="true"
      style={{
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        backgroundColor: 'var(--vscode-sideBar-background)'
      }}
    >
      {/* Todo Drawer - Layered above chat input */}
      {todos.length > 0 && (
        <div className="mb-2">
          <TodoBlock tasks={todos} />
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".sh,.bash,.zsh,.txt,.md,.markdown,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.jsonc,.py,.pyw,.java,.kt,.kts,.cs,.fs,.go,.rs,.cpp,.c,.cc,.cxx,.h,.hpp,.hxx,.rb,.php,.swift,.yaml,.yml,.toml,.ini,.cfg,.conf,.xml,.html,.htm,.css,.scss,.sass,.less,.sql,.r,.lua,.pl,.pm,.env,.gitignore,.dockerignore,.dockerfile,.makefile,.cmake,.gradle,.properties,.log,.csv,text/*,application/json,.jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload files"
          />
          <div className="w-full px-1.5 pt-1.5">
            <div className="flex flex-wrap items-center gap-1 min-h-[28px]">
              {attachments.length === 0 && imageAttachments.length === 0 ? (
                <button
                  type="button"
                  onClick={handleAttachmentClick}
                  disabled={disabled || isStreaming}
                  className="text-xs border border-dashed rounded-md px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    color: 'var(--vscode-descriptionForeground)',
                    borderColor: 'var(--vscode-input-border)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!disabled && !isStreaming) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                      e.currentTarget.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.3)';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--vscode-input-border)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  + No Attachments
                </button>
              ) : (
                <>
                  <AttachmentPreview
                    attachments={attachments}
                    onRemove={handleRemoveAttachment}
                    disabled={disabled}
                  />
                  <ImageAttachmentPreview
                    attachments={imageAttachments}
                    onRemove={handleRemoveImageAttachment}
                    disabled={disabled}
                  />
                  {attachments.length + imageAttachments.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAttachmentClick}
                      disabled={disabled || isStreaming}
                      className="text-xs border border-dashed rounded-md px-2 py-1 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        color: 'var(--vscode-descriptionForeground)',
                        borderColor: 'var(--vscode-input-border)',
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!disabled && !isStreaming) {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                          e.currentTarget.style.boxShadow = '0 0 0 1px rgba(255, 255, 255, 0.3)';
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--vscode-input-border)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      + Add
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="w-full relative rounded-xl">
            {/* Highlight overlay for menu-selected mentions */}
            <div
              aria-hidden="true"
              className="absolute inset-0 px-1.5 py-1 text-sm leading-normal pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
              style={{ color: 'transparent' }}
            >
              {buildHighlightedSegments(input, mentions).map(segment => (
                <span
                  key={segment.key}
                  style={segment.isHighlighted ? MENTION_HIGHLIGHT_STYLE : undefined}
                >
                  {segment.text}
                </span>
              ))}
            </div>
            <textarea
              ref={(el) => {
                (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                setMentionTextareaRef(el);
              }}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type your message..."
              disabled={disabled || isStreaming}
              rows={1}
              className="w-full px-1.5 py-1 rounded-xl bg-transparent text-sm leading-normal min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 disabled:opacity-50 disabled:cursor-not-allowed placeholder:opacity-50 relative"
              style={{
                color: 'var(--vscode-input-foreground)',
                outline: 'none',
                caretColor: 'var(--vscode-input-foreground)',
              }}
            />
            {/* File mention autocomplete menu */}
            {suggestionState.isOpen && (
              <FileMentionMenu
                files={filteredFiles}
                selectedIndex={suggestionState.selectedIndex}
                onSelect={selectFile}
                onClose={closeSuggestions}
              />
            )}
          </div>

          <div className="flex justify-between items-center gap-1 px-1.5 pb-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleAttachmentClick}
                disabled={disabled || isStreaming || attachments.length + imageAttachments.length >= 3}
                className="transition-opacity hover:opacity-70 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: 'var(--vscode-foreground)' }}
                title={attachments.length + imageAttachments.length >= 3 ? 'Maximum 3 attachments' : 'Attach documents'}
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              {mode && onModeChange && (
                <ModeDropdown
                  mode={mode}
                  onModeChange={onModeChange}
                  disabled={disabled || isStreaming}
                />
              )}
              <ChatModelSelector
                provider={provider}
                model={model}
                onChange={onModelChange}
                disabled={disabled || isStreaming}
                direction="up"
              />
            </div>

            <div className="flex items-center gap-1">
              <RefactorIndicator
                largeFiles={largeFiles}
                isScanning={isRefactorScanning}
                disabled={disabled}
                onRefactorRequest={handleRefactorRequest}
              />
              {contextUsage && (
                <ContextIndicator
                  usage={contextUsage}
                  disabled={disabled}
                  mode={mode}
                  isCompressing={isCompressing}
                />
              )}
              {showStopButton ? (
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
                  disabled={disabled || !input.trim()}
                  className="w-7 h-7 rounded-full transition-opacity hover:opacity-90 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#000000'
                  }}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}