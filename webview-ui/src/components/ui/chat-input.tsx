import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent, type ChangeEvent, type ClipboardEvent } from 'react';
import { ArrowUp, Paperclip, Square } from 'lucide-react';

import { TodoBlock } from './todo-block';
import { AttachmentPreview } from './attachment-preview';
import { ImageAttachmentPreview } from './image-attachment-preview';

import { ModeDropdown } from './mode-dropdown';
import { ChatModelSelector } from './chat-model-selector';
import { ContextMenu } from './context-menu';
import { MentionHighlighter } from './mention-highlighter';
import { ContextIndicator } from './context-indicator';
import { RefactorIndicator } from './refactor-indicator';
import { useRefactorScan } from '../../hooks/use-refactor-scan';
import type { ContextUsageResult } from '../../hooks/use-context-usage';

import { useContextMenu } from '../../hooks/use-context-menu';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import { clearMentionPaths, removeMention, getMentionPath, unescapeSpaces, registerMentionPath, parseMentions } from '../../utils/mention-utils';

import { buildRefactorMessage } from '../../utils/message-builders';
import type { TodoTask } from '../../types/todo';
import type { ChatMode } from '../../types/chat-mode';
import { processDocumentFiles, buildAllAttachedFileBlocks, validateDocumentFile, fileToDocumentAttachment, type DocumentAttachment } from '../../utils/document-utils';
import { validateImageFile, fileToImageAttachment } from '../../utils/image-utils';
import type { ImageAttachment } from '../../types/chat';
import type { Provider } from '../../types/api-settings';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: ImageAttachment[], forceEchoSearch?: boolean) => void;

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

export function ChatInput({ onSendMessage, disabled = false, isStreaming = false, isExecutingTool = false, isCompressing = false, onStop, todos = [], mode, onModeChange, provider, model, onModelChange, contextUsage, restoredInput, restoredAttachments, restoredImageAttachments }: ChatInputProps) {
  // Show stop button when streaming OR executing a tool (like echo_search)
  const showStopButton = isStreaming || isExecutingTool;

  const [input, setInput] = useState(restoredInput ?? '');

  const [cursorPos, setCursorPos] = useState(0);
  const [attachments, setAttachments] = useState<DocumentAttachment[]>(restoredAttachments ?? []);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>(restoredImageAttachments ?? []);

  const [scrollTop, setScrollTop] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get workspace files for mentions - use reactive hook so it updates when files change
  const workspace = useWorkspaceContext();
  const workspaceFiles = workspace?.files || [];

  // Get refactor scan results
  const { largeFiles, isScanning: isRefactorScanning } = useRefactorScan();

  // Context menu hook for @ mentions
  const handleInputChange = (newValue: string, newCursorPos?: number) => {
    setInput(newValue);
    if (newCursorPos !== undefined) {
      setCursorPos(newCursorPos);
    }
  };

  const contextMenu = useContextMenu({
    value: input,
    cursorPos,
    onChange: handleInputChange,
    textareaRef,
    workspaceFiles,
    enabled: !disabled && !isStreaming,
  });

  // When we restore aborted input (after a revert/abort), rebuild mention
  // path mappings so that existing @mentions are recognized again.
  useEffect(() => {
    if (!restoredInput || !restoredInput.trim() || workspaceFiles.length === 0) {
      return;
    }

    const mentionPaths = parseMentions(restoredInput, workspaceFiles);
    for (const fullPath of mentionPaths) {
      const basename = fullPath.split(/[/\\]/).pop() || fullPath;
      registerMentionPath(basename, fullPath);
    }
  }, [restoredInput, workspaceFiles]);

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
      clearMentionPaths(); // Clear mention path mappings after sending
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setCursorPos(e.target.selectionStart || 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Let context menu handle keyboard events
    if (contextMenu.handleKeyDown(e)) {
      return;
    }

    // Handle backspace to remove whole mention if it's a registered one
    // Two-step: first backspace removes trailing space, second removes mention
    if (e.key === 'Backspace') {
      // Get fresh cursor position from the textarea
      const currentPos = e.currentTarget.selectionStart || 0;
      const beforeCursor = input.slice(0, currentPos);
      // Only match @mention WITHOUT trailing space (cursor right at end of mention)
      const mentionMatch = beforeCursor.match(/@([^\s@]+)$/);
      if (mentionMatch) {
        const mentionText = unescapeSpaces(mentionMatch[1]);
        // Only remove whole mention if it's registered (highlighted)
        if (getMentionPath(mentionText) !== undefined) {
          e.preventDefault();
          const result = removeMention(input, currentPos);
          if (result) {
            setInput(result.newText);
            setCursorPos(result.newCursorPos);
            // Set cursor position after state update
            requestAnimationFrame(() => {
              if (textareaRef.current) {
                textareaRef.current.setSelectionRange(result.newCursorPos, result.newCursorPos);
              }
            });
          }
          return;
        }
      }
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

  // Track cursor position on selection change
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setCursorPos(target.selectionStart || 0);
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 3 - (attachments.length + imageAttachments.length);
    if (remainingSlots <= 0) return;

    const { attachments: newAttachments, errors } = await processDocumentFiles(files, remainingSlots);
    
    if (errors.length > 0) {
      console.error('Document processing errors:', errors);
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveImageAttachment = (index: number) => {
    setImageAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled || isStreaming) {
      return;
    }

    const clipboard = e.clipboardData;
    if (!clipboard) {
      return;
    }

    const files = clipboard.files;
    if (!files || files.length === 0) {
      return;
    }

    const currentTotal = attachments.length + imageAttachments.length;
    const maxTotal = 3;

    if (currentTotal >= maxTotal) {
      return;
    }

    const remainingSlots = maxTotal - currentTotal;
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

    if (docFiles.length === 0 && imgFiles.length === 0) {
      return;
    }

    const limitedDocFiles = docFiles.slice(0, remainingSlots);
    const remainingAfterDocs = remainingSlots - limitedDocFiles.length;
    const limitedImgFiles = remainingAfterDocs > 0 ? imgFiles.slice(0, remainingAfterDocs) : [];

    const newDocAttachments: DocumentAttachment[] = [];
    const newImageAttachments: ImageAttachment[] = [];

    for (const file of limitedDocFiles) {
      const validation = validateDocumentFile(file);
      if (!validation.valid) {
        console.error('Document processing error for pasted file:', `${file.name}: ${validation.error}`);
        continue;
      }
      try {
        const attachment = await fileToDocumentAttachment(file);
        newDocAttachments.push(attachment);
      } catch {
        console.error('Document processing error for pasted file:', `${file.name}: Failed to read file`);
      }
    }

    for (const file of limitedImgFiles) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        console.error('Image processing error for pasted file:', `${file.name}: ${validation.error}`);
        continue;
      }
      try {
        const attachment = await fileToImageAttachment(file);
        newImageAttachments.push(attachment);
      } catch {
        console.error('Image processing error for pasted file:', `${file.name}: Failed to process`);
      }
    }

    if (newDocAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newDocAttachments]);
    }

    if (newImageAttachments.length > 0) {
      setImageAttachments(prev => [...prev, ...newImageAttachments]);
    }
  };

  const handleRefactorRequest = (filePath: string) => {
    // Extract basename
    const basename = filePath.split(/[/\\]/).pop() || filePath;
    
    // Register mention path so the system knows the full path
    registerMentionPath(basename, filePath);
    
    // Build and send refactor message
    const message = buildRefactorMessage(basename);
    onSendMessage(message, undefined, false);
    
    // Clear mentions after a short delay to ensure processing
    setTimeout(() => {
      clearMentionPaths();
    }, 100);
  };

  return (
    <div
      className="relative w-full"
      data-edit-outside-ignore="true"
      style={{
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        paddingTop: "0.5rem",
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
        className="w-full rounded-xl shadow-sm border transition-colors"
        style={{
          backgroundColor: 'var(--vscode-chat-surface)',
          borderColor: 'var(--vscode-input-border)'
        }}
        aria-label="Chat input area"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-0 p-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".sh,.bash,.zsh,.txt,.md,.markdown,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.jsonc,.py,.pyw,.java,.kt,.kts,.cs,.fs,.go,.rs,.cpp,.c,.cc,.cxx,.h,.hpp,.hxx,.rb,.php,.swift,.yaml,.yml,.toml,.ini,.cfg,.conf,.xml,.html,.htm,.css,.scss,.sass,.less,.sql,.r,.lua,.pl,.pm,.env,.gitignore,.dockerignore,.dockerfile,.makefile,.cmake,.gradle,.properties,.log,.csv,text/*,application/json"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload documents"
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
            {/* Context menu - positioned above textarea */}
            {contextMenu.isOpen && (
              <ContextMenu
                options={contextMenu.options}
                selectedIndex={contextMenu.selectedIndex}
                onSelect={contextMenu.handleSelect}
                onClose={contextMenu.close}
                onMouseDown={contextMenu.preventClose}
                setSelectedIndex={contextMenu.setSelectedIndex}
              />
            )}
            {/* Mention highlighter - positioned behind textarea */}
            <MentionHighlighter text={input} scrollTop={scrollTop} />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onSelect={handleSelect}
              onClick={handleSelect}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              placeholder="Type your message... (use @ for files)"
              disabled={disabled || isStreaming}
              rows={1}
              className="w-full px-1.5 py-1 rounded-xl bg-transparent text-sm leading-normal min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed placeholder:opacity-50"
              style={{
                color: 'var(--vscode-input-foreground)',
                outline: 'none',
                caretColor: 'var(--vscode-input-foreground)',
              }}
            />
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