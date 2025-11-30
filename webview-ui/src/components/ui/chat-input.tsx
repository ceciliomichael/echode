import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { TodoBlock } from './todo-block';
import { AttachmentPreview } from './attachment-preview';
import { ModeDropdown } from './mode-dropdown';
import { ChatModelSelector } from './chat-model-selector';
import type { TodoTask } from '../../types/todo';
import type { ImageAttachment } from '../../types/chat';
import type { ChatMode } from '../../types/chat-mode';
import { processImageFiles } from '../../utils/image-utils';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: ImageAttachment[]) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  todos?: TodoTask[];
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
}

export function ChatInput({ onSendMessage, disabled = false, isStreaming = false, onStop, todos = [], mode, onModeChange }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSendMessage(input.trim(), attachments.length > 0 ? attachments : undefined);
      setInput('');
      setAttachments([]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              disabled={disabled || isStreaming}
              rows={1}
              className="w-full px-1.5 py-1 rounded-lg bg-transparent text-sm leading-tight min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed placeholder:opacity-50"
              style={{
                color: 'var(--vscode-input-foreground)',
                outline: 'none'
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