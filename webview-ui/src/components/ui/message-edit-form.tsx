import { useState, useRef, useEffect, useMemo, type KeyboardEvent, type FormEvent, type ChangeEvent, type ClipboardEvent } from 'react';
import { ArrowUp, Paperclip } from 'lucide-react';
import { AttachmentPreview } from './attachment-preview';
import { ModeDropdown } from './mode-dropdown';
import { ChatModelSelector } from './chat-model-selector';
import { ContextMenu } from './context-menu';
import { MentionHighlighter } from './mention-highlighter';
import { ContextIndicator } from './context-indicator';

import { useContextMenu } from '../../hooks/use-context-menu';
import { useDropdownDirection } from '../../hooks/use-dropdown-direction';
import { useWorkspaceContext } from '../../hooks/use-workspace-context';
import type { ChatMode } from '../../types/chat-mode';
import type { ContextUsageResult } from '../../hooks/use-context-usage';

import { processDocumentFiles, buildAllAttachedFileBlocks, extractTextAndAttachmentsFromContent, validateDocumentFile, fileToDocumentAttachment, type DocumentAttachment } from '../../utils/document-utils';
import { removeMention, getMentionPath, unescapeSpaces, registerMentionPath, parseMentionFilenames } from '../../utils/mention-utils';
import type { Provider } from '../../types/api-settings';

interface MessageEditFormProps {
  initialContent: string;
  onSubmit: (content: string, attachments?: undefined, forceEchoSearch?: boolean) => void;
  onCancel: () => void;
  onSave?: (content: string) => void;
  attachments?: DocumentAttachment[];
  mode?: ChatMode;
  onModeChange?: (mode: ChatMode) => void;
  provider: Provider;
  model: string;
  onModelChange: (provider: Provider, model: string) => void;
  contextUsage?: ContextUsageResult;
}

export function MessageEditForm({ initialContent, onSubmit, onCancel, onSave, attachments, mode, onModeChange, provider, model, onModelChange, contextUsage }: MessageEditFormProps) {

  const parsed = extractTextAndAttachmentsFromContent(initialContent);

  const [editContent, setEditContent] = useState(parsed.text);
  const [cursorPos, setCursorPos] = useState(parsed.text.length);
  const [editAttachments, setEditAttachments] = useState<DocumentAttachment[]>(attachments || parsed.attachments);
  const [scrollTop, setScrollTop] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownDirection = useDropdownDirection(containerRef);

  // Get workspace files for mentions - use reactive hook so it updates when workspace changes
  const workspace = useWorkspaceContext();
  const workspaceFiles = useMemo(() => workspace?.files || [], [workspace]);

  // Register mentions from initial content so they get highlighted
  // Only register mentions that actually match workspace files
  // This prevents pasted @something text from being treated as file mentions
  useMemo(() => {
    const mentions = parseMentionFilenames(parsed.text);
    for (const mention of mentions) {
      // Try to find the full path in workspace files
      const matchingFile = workspaceFiles.find(f => {
        const basename = f.split('/').pop() || f;
        return basename.toLowerCase() === mention.toLowerCase();
      });
      // Only register if it matches an actual workspace file
      if (matchingFile) {
        registerMentionPath(mention, matchingFile);
      }
    }
  }, [parsed.text, workspaceFiles]);

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

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready before focusing
    // This fixes focus issues when restoring editing state from session history
    const frameId = requestAnimationFrame(() => {
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.focus();
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    });
    return () => cancelAnimationFrame(frameId);
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

  const handleSubmit = (e: FormEvent, forceEchoSearch: boolean = false) => {
    e.preventDefault();
    if (editContent.trim()) {
      // Build <attached_file> blocks and append to message content
      const attachmentBlocks = buildAllAttachedFileBlocks(editAttachments);
      const newContent = editContent.trim() + attachmentBlocks;
      onSubmit(newContent, undefined, forceEchoSearch);
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
      // Ctrl+Enter: force echo_search for Agent, Plan, and Ask modes
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSubmit(e, mode === 'agent' || mode === 'plan' || mode === 'ask');
        return;
      }

      // Regular Enter: submit edit
      e.preventDefault();
      handleSubmit(e, false);
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

    const { attachments: newAttachments, errors } = await processDocumentFiles(files, remainingSlots);
    
    if (errors.length > 0) {
      console.error('Document processing errors:', errors);
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

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboard = e.clipboardData;
    if (!clipboard) {
      return;
    }

    const files = clipboard.files;
    if (!files || files.length === 0) {
      return;
    }

    const remainingSlots = 3 - editAttachments.length;
    if (remainingSlots <= 0) {
      return;
    }

    const filesArray = Array.from(files).slice(0, remainingSlots);
    const newAttachments: DocumentAttachment[] = [];

    for (const file of filesArray) {
      const validation = validateDocumentFile(file);
      if (!validation.valid) {
        console.error('Document processing error for pasted file:', `${file.name}: ${validation.error}`);
        continue;
      }
      try {
        const attachment = await fileToDocumentAttachment(file);
        newAttachments.push(attachment);
      } catch {
        console.error('Document processing error for pasted file:', `${file.name}: Failed to read file`);
      }
    }

    if (newAttachments.length > 0) {
      setEditAttachments(prev => [...prev, ...newAttachments]);
    }
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
            accept=".sh,.bash,.zsh,.txt,.md,.markdown,.ts,.tsx,.js,.jsx,.mjs,.cjs,.json,.jsonc,.py,.pyw,.java,.kt,.kts,.cs,.fs,.go,.rs,.cpp,.c,.cc,.cxx,.h,.hpp,.hxx,.rb,.php,.swift,.yaml,.yml,.toml,.ini,.cfg,.conf,.xml,.html,.htm,.css,.scss,.sass,.less,.sql,.r,.lua,.pl,.pm,.env,.gitignore,.dockerignore,.dockerfile,.makefile,.cmake,.gradle,.properties,.log,.csv,text/*,application/json"
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

          <div className="w-full relative rounded-xl">
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
            <MentionHighlighter text={editContent} scrollTop={scrollTop} textareaRef={textareaRef} />
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onSelect={handleSelect}
              onClick={handleSelect}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              placeholder="Type your message... (use @ to mention files)"
              rows={1}
              className="w-full px-1.5 py-1 rounded-xl bg-transparent text-sm leading-normal min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 relative z-10"
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
                  direction={dropdownDirection}
                />
              )}
              <ChatModelSelector
                provider={provider}
                model={model}
                onChange={onModelChange}
                disabled={false}
                direction={dropdownDirection}
              />
            </div>

            <div className="flex items-center gap-2">
              {contextUsage && (
                <ContextIndicator
                  usage={contextUsage}
                  disabled={false}
                  mode={mode}
                />
              )}
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