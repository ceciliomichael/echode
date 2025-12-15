import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { usePasteHandler } from '../../hooks/use-paste-handler';
import { ArrowUp, Paperclip } from 'lucide-react';
import { AttachmentPreview } from './attachment-preview';
import { ImageAttachmentPreview } from './image-attachment-preview';
import { ModeDropdown } from './mode-dropdown';
import { ChatModelSelector } from './chat-model-selector';
import { ContextIndicator } from './context-indicator';

import { useDropdownDirection } from '../../hooks/use-dropdown-direction';
import type { ChatMode } from '../../types/chat-mode';
import type { ContextUsageResult } from '../../hooks/use-context-usage';

import { processDocumentFiles, buildAllAttachedFileBlocks, extractTextAndAttachmentsFromContent, validateDocumentFile, type DocumentAttachment } from '../../utils/document-utils';
import { validateImageFile, processImageFiles } from '../../utils/image-utils';
import type { ImageAttachment } from '../../types/chat';
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
  const [editAttachments, setEditAttachments] = useState<DocumentAttachment[]>(attachments || parsed.attachments);
  const [editImageAttachments, setEditImageAttachments] = useState<ImageAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownDirection = useDropdownDirection(containerRef);

  const { handlePaste } = usePasteHandler({
    attachments: editAttachments,
    setAttachments: setEditAttachments,
    imageAttachments: editImageAttachments,
    setImageAttachments: setEditImageAttachments,
    disabled: false
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
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 3 - (editAttachments.length + editImageAttachments.length);
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
        setEditAttachments(prev => [...prev, ...newDocAttachments]);
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
        setEditImageAttachments(prev => [...prev, ...newImgAttachments]);
      }
    }

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
    setEditAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveImageAttachment = (index: number) => {
    setEditImageAttachments(prev => prev.filter((_, i) => i !== index));
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
              {editAttachments.length === 0 && editImageAttachments.length === 0 ? (
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
                  <ImageAttachmentPreview
                    attachments={editImageAttachments}
                    onRemove={handleRemoveImageAttachment}
                    disabled={false}
                  />
                  {editAttachments.length + editImageAttachments.length < 3 && (
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
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Type your message..."
              rows={1}
              className="w-full px-1.5 py-1 rounded-xl bg-transparent text-sm leading-normal min-h-[36px] max-h-[100px] overflow-y-auto resize-none border-0 relative"
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
                disabled={editAttachments.length + editImageAttachments.length >= 3}
                className="transition-opacity hover:opacity-70 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: 'var(--vscode-foreground)' }}
                title={editAttachments.length + editImageAttachments.length >= 3 ? 'Maximum 3 attachments' : 'Attach files'}
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