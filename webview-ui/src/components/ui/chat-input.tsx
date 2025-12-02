import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { TodoBlock } from './todo-block';
import { AttachmentPreview } from './attachment-preview';
import { ModeDropdown } from './mode-dropdown';
import { ChatModelSelector } from './chat-model-selector';
import { ContextMenu } from './context-menu';
import { MentionHighlighter } from './mention-highlighter';
import { useContextMenu } from '../../hooks/use-context-menu';
import { clearMentionPaths, removeMention, getMentionPath, unescapeSpaces } from '../../utils/mention-utils';
import type { TodoTask } from '../../types/todo';
import type { ImageAttachment } from '../../types/chat';
import type { ChatMode } from '../../types/chat-mode';
import { processImageFiles } from '../../utils/image-utils';
import type { Provider } from '../../types/api-settings';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: ImageAttachment[], forceEchoSearch?: boolean) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  todos?: TodoTask[];
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  echoSearchEnabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled = false, isStreaming = false, onStop, todos = [], mode, onModeChange, provider, model, onModelChange, echoSearchEnabled = true }: ChatInputProps) {

  const [input, setInput] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get workspace files for mentions
  const workspaceFiles = window.workspaceContext?.files || [];

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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e: FormEvent, forceEchoSearch: boolean = false) => {
    e.preventDefault();
    const content = input;
    // Only use trim() to check for non-empty content, but send the original text
    if (content.trim() && !disabled) {
      onSendMessage(content, attachments.length > 0 ? attachments : undefined, forceEchoSearch);
      setInput('');
      setAttachments([]);
      clearMentionPaths(); // Clear mention path mappings after sending
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setCursorPos(e.target.selectionStart || 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Let context menu handle keyboard events first
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
      e.preventDefault();
      // Ctrl+Enter forces echo_search with the query (only if echo_search is enabled)
      const forceEchoSearch = (e.ctrlKey || e.metaKey) && echoSearchEnabled;
      handleSubmit(e, forceEchoSearch);
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

    const remainingSlots = 3 - attachments.length;
    if (remainingSlots <= 0) return;

    const { attachments: newAttachments, errors } = await processImageFiles(files, remainingSlots);
    
    if (errors.length > 0) {
      console.error('Image processing errors:', errors);
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

  return (
    <div
      className="px-3 relative"
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
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload images"
          />
          <div className="w-full px-1.5 pt-1.5">
            <div className="flex flex-wrap items-center gap-1 min-h-[28px]">
              {attachments.length === 0 ? (
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
                  {attachments.length < 3 && (
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

          <div className="w-full relative rounded-lg">
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
              onSelect={handleSelect}
              onClick={handleSelect}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              placeholder="Type your message... (use @ to mention files)"
              disabled={disabled || isStreaming}
              rows={1}
              className="w-full px-1.5 py-1 rounded-lg bg-transparent text-sm leading-normal min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed placeholder:opacity-50"
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
                disabled={disabled || isStreaming || attachments.length >= 3}
                className="transition-opacity hover:opacity-70 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: 'var(--vscode-foreground)' }}
                title={attachments.length >= 3 ? 'Maximum 3 attachments' : 'Attach images'}
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
              {isStreaming ? (
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