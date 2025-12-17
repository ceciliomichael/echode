import { useState, useRef, useEffect, useCallback } from 'react';
import {
  shouldShowContextMenu,
  insertMention,
  ContextMenuOptionType,
  getContextMenuOptions,
  type SearchResult
} from '../utils/context-mentions';
import { vscode } from '../utils/vscode';

interface UseContextMenuOptions {
  input: string;
  setInput: (value: string) => void;
  textareaRef: React.RefObject<{ 
    selectionStart: number; 
    selectionEnd: number;
    setSelectionRange: (start: number, end: number) => void;
    focus: () => void;
  } | null>;
}

interface ContextMenuState {
  showContextMenu: boolean;
  cursorPosition: number;
  searchQuery: string;
  selectedMenuIndex: number;
  selectedMenuType: ContextMenuOptionType | null;
  fileSearchResults: SearchResult[];
}

interface ContextMenuHandlers {
  handleMentionSelect: (type: ContextMenuOptionType, value?: string) => void;
  handleContextMenuKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  updateCursorPosition: (newValue: string, newCursorPos: number) => void;
  setShowContextMenu: (show: boolean) => void;
  setSelectedMenuIndex: (index: number) => void;
  checkContextMenuOnFocus: () => void;
}

export interface UseContextMenuReturn extends ContextMenuState, ContextMenuHandlers {
  mentionPathMap: React.MutableRefObject<Map<string, string>>;
}

export function useContextMenu({
  input,
  setInput,
  textareaRef
}: UseContextMenuOptions): UseContextMenuReturn {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [selectedMenuType, setSelectedMenuType] = useState<ContextMenuOptionType | null>(null);
  const [fileSearchResults, setFileSearchResults] = useState<SearchResult[]>([]);
  
  // Map to store filename -> path for short display mentions
  const mentionPathMap = useRef<Map<string, string>>(new Map());

  // Listen for file search results from extension
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
    if (showContextMenu) {
      if (selectedMenuType !== null) {
        vscode.postMessage({
          type: 'searchFiles',
          query: searchQuery,
          searchType: selectedMenuType
        });
      } else if (searchQuery.length > 0) {
        // Mixed search (files + folders) when no specific type is selected
        vscode.postMessage({
          type: 'searchFiles',
          query: searchQuery,
          searchType: 'all'
        });
      }
    }
  }, [showContextMenu, searchQuery, selectedMenuType]);

  const updateCursorPosition = useCallback((newValue: string, newCursorPos: number) => {
    setCursorPosition(newCursorPos);

    if (shouldShowContextMenu(newValue, newCursorPos)) {
      setShowContextMenu(true);
      // Reset to first item when menu opens
      if (!showContextMenu) {
        setSelectedMenuIndex(0);
      }
      const lastAtIndex = newValue.lastIndexOf('@', newCursorPos - 1);
      const query = newValue.slice(lastAtIndex + 1, newCursorPos);
      setSearchQuery(query);

      // Reset to categories if query is cleared, regardless of current mode
      if (query.length === 0) {
        setSelectedMenuType(null);
      }
    } else {
      setShowContextMenu(false);
      setSelectedMenuType(null);
    }
  }, [showContextMenu, selectedMenuType]);

  const handleMentionSelect = useCallback((type: ContextMenuOptionType, value?: string) => {
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
      const basename = value.split('/').pop() || value;

      // Always use the basename as label, overwrite any previous mapping
      mentionPathMap.current.set(basename, value);

      const { newValue, mentionIndex } = insertMention(input, cursorPosition, value, basename);
      setInput(newValue);
      const newCursorPos = newValue.indexOf(' ', mentionIndex + basename.length + 2) + 1;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          textareaRef.current.focus();
        }
      }, 0);
    }
  }, [input, cursorPosition, setInput, textareaRef]);

  const handleContextMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!showContextMenu) return false;

    if (e.key === 'Escape') {
      // If in submenu, go back to category menu; otherwise close
      if (selectedMenuType !== null) {
        setSelectedMenuType(null);
        setSelectedMenuIndex(0);
      } else {
        setShowContextMenu(false);
      }
      return true;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const direction = e.key === 'ArrowUp' ? -1 : 1;
      const options = getContextMenuOptions(searchQuery, selectedMenuType, fileSearchResults);
      if (options.length > 0) {
        setSelectedMenuIndex(prev => (prev + direction + options.length) % options.length);
      }
      return true;
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
      return true;
    }

    return false;
  }, [showContextMenu, selectedMenuType, searchQuery, fileSearchResults, selectedMenuIndex, handleMentionSelect]);

  const checkContextMenuOnFocus = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const cursorPos = textarea.selectionStart;
      if (shouldShowContextMenu(input, cursorPos)) {
        setShowContextMenu(true);
        const lastAtIndex = input.lastIndexOf('@', cursorPos - 1);
        const query = input.slice(lastAtIndex + 1, cursorPos);
        setSearchQuery(query);
      }
    }
  }, [input, textareaRef]);

  return {
    // State
    showContextMenu,
    cursorPosition,
    searchQuery,
    selectedMenuIndex,
    selectedMenuType,
    fileSearchResults,
    mentionPathMap,
    // Handlers
    handleMentionSelect,
    handleContextMenuKeyDown,
    updateCursorPosition,
    setShowContextMenu,
    setSelectedMenuIndex,
    checkContextMenuOnFocus
  };
}