import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { ArrowUp, Paperclip } from 'lucide-react';
import { AttachmentPreview } from './attachment-preview';
import { ModeDropdown } from './mode-dropdown';
import { ChatModelSelector } from './chat-model-selector';
import { ContextMenu } from './context-menu';
import { MentionHighlighter } from './mention-highlighter';
import { useContextMenu } from '../../hooks/use-context-menu';
import type { ImageAttachment } from '../../types/chat';
import type { ChatMode } from '../../types/chat-mode';
import { processImageFiles } from '../../utils/image-utils';
import { removeMention, getMentionPath, unescapeSpaces, registerMentionPath, parseMentionFilenames } from '../../utils/mention-utils';

interface MessageEditFormProps {
  initialContent: string;
  onSubmit: (content: string, attachments?: ImageAttachment[]) => void;
  onCancel: () => void;
  onSave?: (content: string) => void;
  attachments?: ImageAttachment[];
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
}

export function MessageEditForm({ initialContent, onSubmit, onCancel, onSave, attachments, mode, onModeChange }: MessageEditFormProps) {
  const [editContent, setEditContent] = useState(initialContent);
  const [cursorPos, setCursorPos] = useState(initialContent.length);
  const [editAttachments, setEditAttachments] = useState<ImageAttachment[]>(attachments || []);
  const [scrollTop, setScrollTop] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get workspace files for mentions
  const workspaceFiles = window.workspaceContext?.files || [];

  // Context menu hook for @ mentions
  const handleInputChange = (newValue: string, newCursorPos?: number) => {
    setEditContent(newValue);
    if (newCursorPos !== undefined) {
      setCursorPos(newCursorPos);
    }
  };

  const contextMenu = useContextMenu({
    value: editContent,
    cursorPos,
    onChange: handleInputChange,
    textareaRef,
    workspaceFiles,
    enabled: true,
  });

  // Register mentions from initial content so they get highlighted
  useEffect(() => {
    const mentions = parseMentionFilenames(initialContent);
    for (const mention of mentions) {
      // Try to find the full path in workspace files
      const matchingFile = workspaceFiles.find(f => {
        const basename = f.split('/').pop() || f;
        return basename.toLowerCase() === mention.toLowerCase();
      });
      // Register with the matched path or just the mention itself
      registerMentionPath(mention, matchingFile || mention);
    }
  }, [initialContent, workspaceFiles]);

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
      const target = event.target as Node | null;
      if (!containerRef.current || !target) {
        return;
      }

      if (containerRef.current.contains(target)) {
        return;
      }

      const element = target as HTMLElement;
      if (element.closest('[data-edit-outside-ignore="true"]')) {
        return;
      }

      // Cancel edit without saving when clicking outside
      onCancel();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (editContent.trim()) {
      const newContent = editContent.trim();
      onSubmit(newContent, editAttachments.length > 0 ? editAttachments : undefined);
      if (onSave) {
        onSave(newContent);
      }
    } else {
      onCancel();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value);
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
      const beforeCursor = editContent.slice(0, currentPos);
      // Only match @mention WITHOUT trailing space (cursor right at end of mention)
      const mentionMatch = beforeCursor.match(/@([^\s@]+)$/);
      if (mentionMatch) {
        const mentionText = unescapeSpaces(mentionMatch[1]);
        // Only remove whole mention if it's registered (highlighted)
        if (getMentionPath(mentionText) !== undefined) {
          e.preventDefault();
          const result = removeMention(editContent, currentPos);
          if (result) {
            setEditContent(result.newText);
            setCursorPos(result.newCursorPos);
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
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      onCancel();
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

    const remainingSlots = 3 - editAttachments.length;
    if (remainingSlots <= 0) return;

    const { attachments: newAttachments, errors } = await processImageFiles(files, remainingSlots);
    
    if (errors.length > 0) {
      console.error('Image processing errors:', errors);
    }

    if (newAttachments.length > 0) {
      setEditAttachments(prev => [...prev, ...newAttachments]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setEditAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div ref={containerRef} className="px-2 relative z-[60]">
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
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload images"
          />
          <div className="w-full px-1.5 pt-1.5">
            <div className="flex flex-wrap items-center gap-1 min-h-[28px]">
              {editAttachments.length === 0 ? (
                <button
                  type="button"
                  onClick={handleAttachmentClick}
                  className="text-xs border border-dashed rounded-md px-2 py-1 transition-all hover:opacity-70"
                  style={{
                    color: 'var(--vscode-descriptionForeground)',
                    borderColor: 'var(--vscode-input-border)',
                    backgroundColor: 'transparent'
                  }}
                >
                  + No Attachments
                </button>
              ) : (
                <>
                  <AttachmentPreview
                    attachments={editAttachments}
                    onRemove={handleRemoveAttachment}
                    disabled={false}
                  />
                  {editAttachments.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAttachmentClick}
                      className="text-xs border border-dashed rounded-md px-2 py-1 transition-all hover:opacity-70"
                      style={{
                        color: 'var(--vscode-descriptionForeground)',
                        borderColor: 'var(--vscode-input-border)',
                        backgroundColor: 'transparent'
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
            {/* Context menu - positioned below textarea */}
            {contextMenu.isOpen && (
              <ContextMenu
                options={contextMenu.options}
                selectedIndex={contextMenu.selectedIndex}
                onSelect={contextMenu.handleSelect}
                onClose={contextMenu.close}
                onMouseDown={contextMenu.preventClose}
                setSelectedIndex={contextMenu.setSelectedIndex}
                direction="down"
              />
            )}
            {/* Mention highlighter - positioned behind textarea */}
            <MentionHighlighter text={editContent} scrollTop={scrollTop} highlightAll={true} />
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onSelect={handleSelect}
              onClick={handleSelect}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              placeholder="Type your message... (use @ to mention files)"
              rows={1}
              className="w-full px-1.5 py-1 rounded-lg bg-transparent text-sm leading-normal min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 relative z-10"
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
                disabled={editAttachments.length >= 3}
                className="transition-opacity hover:opacity-70 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: 'var(--vscode-foreground)' }}
                title={editAttachments.length >= 3 ? 'Maximum 3 attachments' : 'Attach images'}
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              {mode && onModeChange && (
                <ModeDropdown
                  mode={mode}
                  onModeChange={onModeChange}
                  disabled={false}
                  direction="down"
                />
              )}
              <ChatModelSelector
                disabled={false}
                direction="down"
              />
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