import { useState, useCallback, useMemo, type RefObject, type KeyboardEvent } from 'react';
import {
  ContextMenuOptionType,
  type ContextMenuItem,
  getContextMenuOptions,
  insertContextMention,
  isOptionSelectable,
} from '../utils/context-mentions';
import { getActiveMention, registerMentionPath, getMentionPath, unescapeSpaces } from '../utils/mention-utils';

interface UseContextMenuOptions {
  value: string;
  cursorPos: number;
  onChange: (newValue: string, newCursorPos?: number) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  workspaceFiles: string[];
  enabled?: boolean;
}

interface UseContextMenuReturn {
  isOpen: boolean;
  options: ContextMenuItem[];
  selectedIndex: number;
  selectedType: ContextMenuOptionType | null;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  handleSelect: (type: ContextMenuOptionType, value?: string) => void;
  close: () => void;
  setSelectedIndex: (index: number) => void;
  preventClose: () => void;
}

// Track closed state per query to avoid showing menu after selection
const closedQueries = new Set<string>();

export function useContextMenu({
  value,
  cursorPos,
  onChange,
  textareaRef,
  workspaceFiles,
  enabled = true,
}: UseContextMenuOptions): UseContextMenuReturn {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Compute active mention from props
  const activeMention = useMemo(() => {
    if (!enabled) return null;
    return getActiveMention(value, cursorPos);
  }, [value, cursorPos, enabled]);

  // If there is no active mention anymore, clear closed queries so a new '@'
  // can reopen the context menu when the user starts typing again.
  if (!activeMention && closedQueries.size > 0) {
    closedQueries.clear();
  }

  const query = activeMention?.query ?? '';
  const queryKey = `${activeMention?.start ?? -1}:${query}`;

  // Check if this query was manually closed
  const isClosed = closedQueries.has(queryKey);

  // If this mention already corresponds to a registered (highlighted) mention,
  // we don't want to show the context menu again.
  const isAlreadyHighlighted = useMemo(() => {
    if (!activeMention) return false;
    const mentionText = unescapeSpaces(activeMention.query);
    return getMentionPath(mentionText) !== undefined;
  }, [activeMention]);

  // Get context menu options based on current state
  const options = useMemo(() => {
    if (!activeMention || isClosed || isAlreadyHighlighted) return [];
    
    // Use search query if drilling into a submenu, otherwise use the main query
    const effectiveQuery = selectedType ? searchQuery : query;
    return getContextMenuOptions(effectiveQuery, selectedType, workspaceFiles);
  }, [activeMention, isClosed, isAlreadyHighlighted, selectedType, searchQuery, query, workspaceFiles]);

  const isOpen = activeMention !== null && options.length > 0 && !isClosed && !isAlreadyHighlighted;

  // Ensure selectedIndex points to a valid selectable option
  // If current selectedIndex is invalid, find the first selectable option
  const validSelectedIndex = useMemo(() => {
    if (options.length === 0) return 0;
    
    // If current index is valid and selectable, use it
    if (selectedIndex >= 0 && selectedIndex < options.length && isOptionSelectable(options[selectedIndex])) {
      return selectedIndex;
    }
    
    // Otherwise find the first selectable option
    const firstSelectable = options.findIndex(isOptionSelectable);
    return firstSelectable >= 0 ? firstSelectable : 0;
  }, [options, selectedIndex]);

  const handleSelect = useCallback((type: ContextMenuOptionType, optionValue?: string) => {
    if (type === ContextMenuOptionType.NoResults) {
      return;
    }

    // Drill down into File or Folder submenu
    if (
      (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) &&
      !optionValue
    ) {
      setSelectedType(type);
      setSearchQuery('');
      setSelectedIndex(0);
      return;
    }

    // Insert the mention
    const { newText, newCursorPos } = insertContextMention(value, cursorPos, type, optionValue);
    
    // Register path mapping for files/folders/problems
    if (type === ContextMenuOptionType.Problems) {
      registerMentionPath('problems', 'problems');
    } else if (optionValue && (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder)) {
      const basename = optionValue.split('/').pop() || optionValue;
      registerMentionPath(basename, optionValue);
    }
    
    onChange(newText, newCursorPos);
    closedQueries.add(queryKey);
    setSelectedIndex(0);
    setSelectedType(null);
    setSearchQuery('');

    // Focus textarea and set cursor position
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  }, [value, cursorPos, onChange, textareaRef, queryKey]);

  const close = useCallback(() => {
    closedQueries.add(queryKey);
    setSelectedIndex(0);
    setSelectedType(null);
    setSearchQuery('');
  }, [queryKey]);

  const preventClose = useCallback(() => {
    // Called on mousedown to prevent close from click outside
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!isOpen || options.length === 0) {
      return false;
    }

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        {
          const direction = e.key === 'ArrowDown' ? 1 : -1;
          setSelectedIndex(prev => {
            if (options.length === 0) {
              return prev;
            }

            // Start from current index if valid, otherwise from first selectable option
            let index = prev;
            if (index < 0 || index >= options.length || !isOptionSelectable(options[index])) {
              const firstSelectable = options.findIndex(isOptionSelectable);
              if (firstSelectable === -1) {
                return prev;
              }
              index = firstSelectable;
            }

            // Walk through options until we find the next selectable one
            for (let i = 0; i < options.length; i += 1) {
              index = (index + direction + options.length) % options.length;
              if (isOptionSelectable(options[index])) {
                return index;
              }
            }

            return prev;
          });
        }
        return true;

      case 'Enter':
      case 'Tab':
        e.preventDefault();
        {
          const option = options[validSelectedIndex];
          if (option && isOptionSelectable(option)) {
            handleSelect(option.type, option.value);
          }
        }
        return true;

      case 'Escape':
        e.preventDefault();
        // If in submenu, go back to top level
        if (selectedType) {
          setSelectedType(null);
          setSearchQuery('');
          setSelectedIndex(0);
        } else {
          close();
        }
        return true;

      case 'Backspace':
        // If in submenu and search is empty, go back to top level
        if (selectedType && searchQuery === '') {
          e.preventDefault();
          setSelectedType(null);
          setSelectedIndex(0);
          return true;
        }
        // Otherwise, update search query
        if (selectedType) {
          setSearchQuery(prev => prev.slice(0, -1));
          setSelectedIndex(0);
          return true;
        }
        return false;

      default:
        // If in submenu, capture alphanumeric keys for search
        if (selectedType && e.key.length === 1 && /[a-zA-Z0-9._-]/.test(e.key)) {
          e.preventDefault();
          setSearchQuery(prev => prev + e.key);
          setSelectedIndex(0);
          return true;
        }
        return false;
    }
  }, [isOpen, options, validSelectedIndex, handleSelect, close, selectedType, searchQuery]);

  return {
    isOpen,
    options,
    selectedIndex: validSelectedIndex,
    selectedType,
    handleKeyDown,
    handleSelect,
    close,
    setSelectedIndex,
    preventClose,
  };
}
