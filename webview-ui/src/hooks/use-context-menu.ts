import { useState, useRef, useEffect, useCallback } from 'react';
import {
  shouldShowContextMenu,
  shouldShowSlashMenu,
  insertMention,
  ContextMenuOptionType,
  getContextMenuOptions,
  type SearchResult,
  type ContextMenuTrigger
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
  currentTrigger: ContextMenuTrigger;
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
  mentionPathMap: Map<string, string>;
  mentionPathMapRef: React.MutableRefObject<Map<string, string>>;
  clearMentionPathMap: () => void;
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
  const [currentTrigger, setCurrentTrigger] = useState<ContextMenuTrigger>(null);
  
  // Map to store filename -> path for short display mentions
  // Using useState instead of useRef so updates trigger re-renders for navigation validation
  const [mentionPathMap, setMentionPathMap] = useState<Map<string, string>>(() => new Map());
  
  // Ref for accessing current map value in callbacks without stale closures
  const mentionPathMapRef = useRef<Map<string, string>>(mentionPathMap);
  mentionPathMapRef.current = mentionPathMap;

  // Listen for file/workflow search results from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'fileSearchResults') {
        setFileSearchResults(message.results || []);
      } else if (message.type === 'workflowSearchResults') {
        setFileSearchResults(message.results || []);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Trigger file/folder/workflow search when query or type changes
  useEffect(() => {
    if (showContextMenu) {
      // Skip search for Problems - it's a static option
      if (selectedMenuType === ContextMenuOptionType.Problems) {
        return;
      }

      // Handle slash command workflow search
      if (currentTrigger === '/') {
        vscode.postMessage({
          type: 'searchWorkflows',
          query: searchQuery
        });
        return;
      }
      
      // Handle @ mention search
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
  }, [showContextMenu, searchQuery, selectedMenuType, currentTrigger]);

  const updateCursorPosition = useCallback((newValue: string, newCursorPos: number) => {
    setCursorPosition(newCursorPos);

    // Check for slash command trigger first
    if (shouldShowSlashMenu(newValue, newCursorPos)) {
      setShowContextMenu(true);
      setCurrentTrigger('/');
      setSelectedMenuType(ContextMenuOptionType.Workflow);
      
      // Reset to first item when menu opens
      if (!showContextMenu) {
        setSelectedMenuIndex(0);
      }
      
      const lastSlashIndex = newValue.lastIndexOf('/', newCursorPos - 1);
      const query = newValue.slice(lastSlashIndex + 1, newCursorPos);
      setSearchQuery(query);
      return;
    }

    // Check for @ mention trigger
    if (shouldShowContextMenu(newValue, newCursorPos)) {
      setShowContextMenu(true);
      setCurrentTrigger('@');
      
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
        setFileSearchResults([]); // Clear stale results to show category menu
      }
      return;
    }
    
    // No trigger found, close menu
    setShowContextMenu(false);
    setSelectedMenuType(null);
    setCurrentTrigger(null);
  }, [showContextMenu, selectedMenuType]);

  const handleMentionSelect = useCallback((type: ContextMenuOptionType, value?: string) => {
    // Handle workflow selection - insert as /[command] (highlighted with brackets like @mentions)
    if (type === ContextMenuOptionType.Workflow && value) {
      setShowContextMenu(false);
      setSelectedMenuType(null);
      setCurrentTrigger(null);
      
      // Extract command name from path, handling both / and \ separators (Windows compatibility)
      const commandName = value.split(/[/\\]/).pop()?.replace(/\.md$/i, '') || value;
      
      // Find where the / trigger started
      const beforeCursor = input.slice(0, cursorPosition);
      const slashIndex = beforeCursor.lastIndexOf('/');
      
      // Build the new value with /[command] format (similar to @[mention])
      const beforeSlash = slashIndex !== -1 ? input.slice(0, slashIndex) : input.slice(0, cursorPosition);
      const afterCursor = input.slice(cursorPosition).replace(/^[^\s]*/, ''); // Remove partial text after cursor
      const slashCommand = `/[${commandName}]`;
      const newValue = beforeSlash + slashCommand + ' ' + afterCursor;
      const newCursorPos = beforeSlash.length + slashCommand.length + 1;
      
      setInput(newValue);
      
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          textareaRef.current.focus();
        }
      }, 0);
      return;
    }

    // If this is a category selection (File or Folder without a value), enter that category
    // and reset the input text to just "@" for a clean search
    if ((type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) && !value) {
      // Reset input to just "@" by removing the partial query (e.g., "@fi" -> "@")
      const lastAtIndex = input.lastIndexOf('@', cursorPosition - 1);
      if (lastAtIndex !== -1) {
        const beforeAt = input.slice(0, lastAtIndex);
        const afterCursor = input.slice(cursorPosition);
        const resetValue = beforeAt + '@' + afterCursor;
        setInput(resetValue);
        
        // Update cursor position to be right after the @
        const newCursor = lastAtIndex + 1;
        setCursorPosition(newCursor);
        setSearchQuery('');
        
        // Set cursor in textarea
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(newCursor, newCursor);
            textareaRef.current.focus();
          }
        }, 0);
      }
      
      setSelectedMenuType(type);
      setSelectedMenuIndex(0);
      return;
    }

    // Problems category: directly insert the mention (single-click behavior)
    // Auto-set the value so it falls through to the insertion logic
    if (type === ContextMenuOptionType.Problems && !value) {
      value = '__problems__';
    }

    // Otherwise, complete the mention selection
    setShowContextMenu(false);
    setSelectedMenuType(null);
    setCurrentTrigger(null);

    if (value) {
      // Determine the display label
      // For Problems, use "problems" as label (not the internal "__problems__" value)
      const label = type === ContextMenuOptionType.Problems 
        ? "problems" 
        : (value.split('/').pop() || value);

      // Map the display label to the internal value/path
      // Create a new Map to trigger React state update and re-render
      setMentionPathMap(prev => {
        const newMap = new Map(prev);
        newMap.set(label, value);
        return newMap;
      });

      const { newValue, mentionIndex } = insertMention(input, cursorPosition, value, label);
      setInput(newValue);
      const newCursorPos = newValue.indexOf(' ', mentionIndex + label.length + 2) + 1;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          textareaRef.current.focus();
        }
      }, 0);
    }
  }, [input, cursorPosition, setInput, textareaRef]);

  const handleContextMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!showContextMenu) {return false;}

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
      const options = getContextMenuOptions(searchQuery, selectedMenuType, fileSearchResults);
      
      // Check if there are valid selectable options
      const hasValidOptions = options.length > 0 && 
        options.some(opt => opt.type !== ContextMenuOptionType.NoResults);
      
      if (hasValidOptions && selectedMenuIndex >= 0 && selectedMenuIndex < options.length) {
        const option = options[selectedMenuIndex];
        if (option.type !== ContextMenuOptionType.NoResults) {
          e.preventDefault();
          handleMentionSelect(option.type, option.value);
          return true;
        }
      }
      
      // No valid options - close menu and let the message be sent
      // (Don't prevent default, don't return true - let the keydown propagate)
      setShowContextMenu(false);
      setSelectedMenuType(null);
      setCurrentTrigger(null);
      return false;
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

  // Clear the mention path map (called on message submit)
  const clearMentionPathMap = useCallback(() => {
    setMentionPathMap(new Map());
  }, []);

  return {
    // State
    showContextMenu,
    cursorPosition,
    searchQuery,
    selectedMenuIndex,
    selectedMenuType,
    fileSearchResults,
    currentTrigger,
    mentionPathMap,
    mentionPathMapRef,
    // Handlers
    handleMentionSelect,
    handleContextMenuKeyDown,
    updateCursorPosition,
    setShowContextMenu,
    setSelectedMenuIndex,
    checkContextMenuOnFocus,
    clearMentionPathMap
  };
}