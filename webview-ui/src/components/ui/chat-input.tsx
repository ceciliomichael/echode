import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent, type ChangeEvent } from 'react';
import { usePasteHandler } from '../../hooks/use-paste-handler';
import { mentionRegex } from '../../utils/context-mentions';
import { ArrowUp, Paperclip, Square } from 'lucide-react';

import { TodoBlock } from './todo-block';
import { AttachmentPreview } from './attachment-preview';
import { ImageAttachmentPreview } from './image-attachment-preview';

import { ModeDropdown } from './mode-dropdown';
import { ChatModelSelector } from './chat-model-selector';
import { ContextIndicator } from './context-indicator';
import { RefactorIndicator } from './refactor-indicator';
import { useRefactorScan } from '../../hooks/use-refactor-scan';
import type { ContextUsageResult } from '../../hooks/use-context-usage';

import { buildRefactorMessage } from '../../utils/message-builders';
import type { TodoTask } from '../../types/todo';
import type { ChatMode } from '../../types/chat-mode';
import { processDocumentFiles, buildAllAttachedFileBlocks, validateDocumentFile, type DocumentAttachment } from '../../utils/document-utils';
import { validateImageFile, processImageFiles } from '../../utils/image-utils';
import type { ImageAttachment, Message } from '../../types/chat';
import type { Provider } from '../../types/api-settings';
import { ContextMenu } from './context-menu';
import {
  shouldShowContextMenu,
  insertMention,
  ContextMenuOptionType,
  type SearchResult,
  getContextMenuOptions
} from '../../utils/context-mentions';
import { vscode } from '../../utils/vscode';
import { InputWithHighlights, type InputWithHighlightsRef } from './input-with-highlights';

interface ChatInputProps {
  onSendMessage: (message: string, attachments?: ImageAttachment[], forceEchoSearch?: boolean, overrideMessages?: Message[]) => void;
  onNewChat?: () => void;

  disabled?: boolean;
  isStreaming?: boolean;
  isExecutingTool?: boolean;
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

export function ChatInput({ onSendMessage, onNewChat, disabled = false, isStreaming = false, isExecutingTool = false, onStop, todos = [], mode, onModeChange, provider, model, onModelChange, contextUsage, restoredInput, restoredAttachments, restoredImageAttachments }: ChatInputProps) {
  // Show stop button when streaming OR executing a tool (like echo_search)
  const showStopButton = isStreaming || isExecutingTool;

  const [input, setInput] = useState(restoredInput ?? '');
  const [attachments, setAttachments] = useState<DocumentAttachment[]>(restoredAttachments ?? []);
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>(restoredImageAttachments ?? []);

  const textareaRef = useRef<InputWithHighlightsRef | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get refactor scan results
  const { largeFiles, isScanning: isRefactorScanning } = useRefactorScan();

  // Mention state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);

  const [selectedMenuType, setSelectedMenuType] = useState<ContextMenuOptionType | null>(null);
  const [fileSearchResults, setFileSearchResults] = useState<SearchResult[]>([]);
  // Map to store filename -> path for short display mentions
  // using a ref since we don't need re-renders when this updates
  const mentionPathMap = useRef<Map<string, string>>(new Map());

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
      // Expand mentions to full format: @[label](path)
      let expandedContent = content;
      // We use a regex replacement to find mentions @[label] and replace with @[label](path)
      // if we have the path in our map
      expandedContent = expandedContent.replace(mentionRegex, (match, label, path) => {
        // If it already has a path (from paste or history?), keep it unless we want to normalize?
        // The regex @[label](path) might match fully if user typed it or it came from somewhere else.
        // Wait, our new regex finds @[label] group 1, and optional group 2 (path).

        if (path) return match; // Already has path

        const storedPath = mentionPathMap.current.get(label);
        if (storedPath) {
          return `@[${label}](${storedPath})`;
        }
        return match;
      });

      // Build <attached_file> blocks and append to message content
      const attachmentBlocks = buildAllAttachedFileBlocks(attachments);
      const contentWithAttachments = expandedContent + attachmentBlocks;

      onSendMessage(
        contentWithAttachments,
        imageAttachments,
        forceEchoSearch
      );

      setInput('');
      setAttachments([]);
      setImageAttachments([]);
      mentionPathMap.current.clear();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPos = e.target.selectionStart;
    setInput(newValue);
    setCursorPosition(newCursorPos);

    if (shouldShowContextMenu(newValue, newCursorPos)) {
      setShowContextMenu(true);
      // Reset to first item when menu opens
      if (!showContextMenu) {
        setSelectedMenuIndex(0);
      }
      const lastAtIndex = newValue.lastIndexOf("@", newCursorPos - 1);
      const query = newValue.slice(lastAtIndex + 1, newCursorPos);
      setSearchQuery(query);
    } else {
      setShowContextMenu(false);
      setSelectedMenuType(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showContextMenu) {
      if (e.key === 'Escape') {
        // If in submenu, go back to category menu; otherwise close
        if (selectedMenuType !== null) {
          setSelectedMenuType(null);
          setSelectedMenuIndex(0);
        } else {
          setShowContextMenu(false);
        }
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const direction = e.key === 'ArrowUp' ? -1 : 1;
        const options = getContextMenuOptions(searchQuery, selectedMenuType, fileSearchResults);
        if (options.length > 0) {
          setSelectedMenuIndex(prev => (prev + direction + options.length) % options.length);
        }
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const options = getContextMenuOptions(searchQuery, selectedMenuType, fileSearchResults);
        if (options.length > 0 && selectedMenuIndex >= 0 && selectedMenuIndex < options.length) {
          const option = options[selectedMenuIndex];
          if (option.type !== ContextMenuOptionType.NoResults) {
            handleMentionSelect(option.type, option.value);
          }
        }
        return;
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

  const handleMentionSelect = (type: ContextMenuOptionType, value?: string) => {
    // If this is a category selection (File or Folder without a value), enter that category
    if ((type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) && !value) {
      setSelectedMenuType(type);
      setSelectedMenuIndex(0);
      return;
    }

    // Otherwise, complete the mention selection
    setShowContextMenu(false);
    setSelectedMenuType(null);

    if (value) {
      // Logic to disambiguate if multiple files have same name?
      // For now, simplify: assume unique basenames or that the user selected one.
      // We can append (1), (2) if needed but that requires verifying against existing keys.

      const basename = value.split('/').pop() || value;
      let label = basename;
      let counter = 1;
      while (mentionPathMap.current.has(label) && mentionPathMap.current.get(label) !== value) {
        label = `${basename} (${counter})`;
        counter++;
      }

      mentionPathMap.current.set(label, value);

      const { newValue, mentionIndex } = insertMention(input, cursorPosition, value, label);
      setInput(newValue);
      const newCursorPos = newValue.indexOf(" ", mentionIndex + label.length + 2) + 1; // +2 for starting @[
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  // Listen for file search results
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'fileSearchResults') {
        setFileSearchResults(message.results || []);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Trigger file/folder search when query or type changes
  useEffect(() => {
    if (showContextMenu && selectedMenuType !== null) {
      vscode.postMessage({
        type: "searchFiles",
        query: searchQuery,
        searchType: selectedMenuType // 'file' or 'folder'
      });
    }
  }, [showContextMenu, searchQuery, selectedMenuType]);

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
                  className="text-xs border border-dashed rounded-xl px-2 py-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="text-xs border border-dashed rounded-xl px-2 py-1 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            {showContextMenu && (
              <div className="absolute bottom-full left-0 right-0 z-50">
                <ContextMenu
                  onSelect={handleMentionSelect}
                  searchQuery={searchQuery}
                  onMouseDown={(e) => e.preventDefault()}
                  selectedIndex={selectedMenuIndex}
                  setSelectedIndex={setSelectedMenuIndex}
                  selectedType={selectedMenuType}
                  dynamicSearchResults={fileSearchResults}
                />
              </div>
            )}
            <InputWithHighlights
              ref={textareaRef}
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
              }}
              onValueChange={(newValue: string, newCursorPos: number) => {
                setInput(newValue);
                setCursorPosition(newCursorPos);
                setTimeout(() => {
                  if (textareaRef.current) {
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                    textareaRef.current.focus();
                  }
                }, 0);
              }}
              onBlur={() => setShowContextMenu(false)}
              onFocus={() => {
                // Recheck if context menu should show when refocusing
                const textarea = textareaRef.current;
                if (textarea) {
                  const cursorPos = textarea.selectionStart;
                  if (shouldShowContextMenu(input, cursorPos)) {
                    setShowContextMenu(true);
                    const lastAtIndex = input.lastIndexOf("@", cursorPos - 1);
                    const query = input.slice(lastAtIndex + 1, cursorPos);
                    setSearchQuery(query);
                  }
                }
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