import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { ArrowUp, Paperclip } from 'lucide-react';

interface MessageEditFormProps {
  initialContent: string;
  onSubmit: (content: string) => void;
  onCancel: () => void;
  onSave?: (content: string) => void;
}

export function MessageEditForm({ initialContent, onSubmit, onCancel, onSave }: MessageEditFormProps) {
  const [editContent, setEditContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.focus();
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editContent]);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (editContent.trim() && editContent !== initialContent && onSave) {
          onSave(editContent.trim());
        }
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel, editContent, initialContent, onSave]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editContent.trim()) {
      onSubmit(editContent.trim());
    } else {
      onCancel();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div ref={containerRef} className="px-2">
      <section
        className="w-full rounded-xl shadow-sm border p-1 transition-colors"
        style={{
          backgroundColor: 'var(--vscode-chat-surface)',
          borderColor: 'var(--vscode-input-border)'
        }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-0">
          <div className="w-full px-1.5 pt-1.5">
            <div className="flex flex-wrap items-center gap-1 h-[28px]">
              <button
                type="button"
                disabled
                className="text-xs border border-dashed rounded-md px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  color: 'var(--vscode-descriptionForeground)',
                  borderColor: 'var(--vscode-input-border)',
                  backgroundColor: 'transparent'
                }}
              >
                + No Attachments
              </button>
            </div>
          </div>

          <div className="w-full relative rounded-lg">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full px-1.5 py-1 rounded-lg bg-transparent text-sm leading-tight min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 relative z-10"
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
                disabled
                className="transition-opacity hover:opacity-70 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: 'var(--vscode-foreground)' }}
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!editContent.trim()}
                className="w-7 h-7 rounded-full transition-opacity hover:opacity-90 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#000000'
                }}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}