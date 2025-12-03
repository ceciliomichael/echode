import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent, type ChangeEvent, type ReactNode } from 'react';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { useAutoResizeTextarea } from '../../hooks/use-auto-resize-textarea';
import { useHoverEffect, hoverPresets } from '../../hooks/use-hover-effect';

interface BaseMessageInputProps {
  initialValue?: string;
  placeholder?: string;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  autoFocus?: boolean;
  showStopButton?: boolean;
  containerClassName?: string;
  extraActions?: ReactNode;
}

/**
 * Base component for message input forms
 * Eliminates duplication between chat-input and message-edit-form
 * Follows Single Responsibility Principle
 */
export function BaseMessageInput({
  initialValue = '',
  placeholder = 'Type your message...',
  onSubmit,
  onCancel,
  disabled = false,
  isStreaming = false,
  onStop,
  autoFocus = false,
  showStopButton = false,
  containerClassName = 'px-3',
  extraActions,
}: BaseMessageInputProps) {
  const [input, setInput] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { handleMouseEnter, handleMouseLeave } = useHoverEffect();

  useAutoResizeTextarea(textareaRef, input);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, [autoFocus]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSubmit(input.trim());
      setInput('');
    } else if (!input.trim() && onCancel) {
      onCancel();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <div
      className={containerClassName}
      style={{
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        paddingTop: "0.5rem",
        backgroundColor: 'var(--vscode-sideBar-background)'
      }}
    >
      <section
        className="w-full rounded-xl shadow-sm border p-1 transition-colors"
        style={{
          backgroundColor: 'var(--vscode-chat-surface)',
          borderColor: 'var(--vscode-input-border)'
        }}
        aria-label="Message input area"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-0">
          <div className="w-full px-1.5 pt-1.5">
            <div className="flex flex-wrap items-center gap-1 h-[28px]">
              <button
                type="button"
                disabled={disabled}
                className="text-xs border border-dashed rounded-md px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  color: 'var(--vscode-descriptionForeground)',
                  borderColor: 'var(--vscode-input-border)',
                  backgroundColor: 'transparent'
                }}
                onMouseEnter={(e) => !disabled && handleMouseEnter(e, hoverPresets.button.enter)}
                onMouseLeave={(e) => handleMouseLeave(e, hoverPresets.button.leave)}
              >
                + No Attachments
              </button>
            </div>
          </div>

          <div className="w-full relative rounded-xl">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isStreaming}
              rows={1}
              className="w-full px-1.5 py-1 rounded-xl bg-transparent text-sm leading-tight min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed placeholder:opacity-50"
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
                disabled={disabled}
                className="transition-opacity hover:opacity-70 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: 'var(--vscode-foreground)' }}
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              {extraActions}
            </div>

            <div className="flex items-center gap-1">
              {showStopButton && isStreaming ? (
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
