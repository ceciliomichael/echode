/**
 * useFileMention Hook
 * 
 * Manages @file.ext mention autocomplete state for textarea inputs.
 * Detects @ trigger, shows file suggestions, and tracks which mentions
 * were selected from the menu (for blue highlighting).
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import type { FileMention, FileMentionSuggestionState } from '../types/file-mention';

interface UseFileMentionOptions {
    /** Current text value of the textarea */
    value: string;
    /** Callback to update the text value */
    onChange: (newValue: string) => void;
    /** List of available files from workspace */
    files: string[];
    /** Whether the input is disabled */
    disabled?: boolean;
}

interface UseFileMentionReturn {
    /** Current suggestion dropdown state */
    suggestionState: FileMentionSuggestionState;
    /** List of filtered file suggestions */
    filteredFiles: string[];
    /** Currently tracked mentions (with selection source) */
    mentions: FileMention[];
    /** Handle keydown events for keyboard navigation */
    handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
    /** Handle text change to detect @ trigger */
    handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    /** Select a file from the suggestion menu */
    selectFile: (filePath: string) => void;
    /** Close the suggestion menu */
    closeSuggestions: () => void;
    /** Callback ref setter for textarea */
    setTextareaRef: (el: HTMLTextAreaElement | null) => void;
}

const INITIAL_SUGGESTION_STATE: FileMentionSuggestionState = {
    isOpen: false,
    query: '',
    triggerPosition: 0,
    selectedIndex: 0,
};

/**
 * Fuzzy match a query against a file path
 */
function fuzzyMatch(query: string, filePath: string): boolean {
    const lowerQuery = query.toLowerCase();
    const lowerPath = filePath.toLowerCase();

    // Check if query chars appear in order in the path
    let queryIdx = 0;
    for (let i = 0; i < lowerPath.length && queryIdx < lowerQuery.length; i++) {
        if (lowerPath[i] === lowerQuery[queryIdx]) {
            queryIdx++;
        }
    }
    return queryIdx === lowerQuery.length;
}

/**
 * Extract just the filename from a path for display
 */
function getFileName(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
}

export function useFileMention({
    value,
    onChange,
    files,
    disabled = false,
}: UseFileMentionOptions): UseFileMentionReturn {
    const [suggestionState, setSuggestionState] = useState<FileMentionSuggestionState>(INITIAL_SUGGESTION_STATE);
    const [mentions, setMentions] = useState<FileMention[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const prevValueRef = useRef<string>(value);

    // Callback ref setter for textarea
    const setTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
        textareaRef.current = el;
    }, []);

    // Filter files based on current query
    const filteredFiles = useMemo(() => {
        const filtered = suggestionState.isOpen && suggestionState.query
            ? files.filter(f => fuzzyMatch(suggestionState.query, f)).slice(0, 10)
            : files.slice(0, 10);
        return filtered;
    }, [files, suggestionState.isOpen, suggestionState.query]);

    // Compute safe selected index (clamped to filtered files length)
    const safeSelectedIndex = useMemo(() => {
        if (filteredFiles.length === 0) return 0;
        return Math.min(suggestionState.selectedIndex, filteredFiles.length - 1);
    }, [suggestionState.selectedIndex, filteredFiles.length]);

    // Clean mentions when value changes - done synchronously in handler
    const cleanMentions = useCallback((newValue: string) => {
        if (!newValue) {
            setMentions([]);
            return;
        }

        if (prevValueRef.current !== newValue) {
            setMentions(prev => prev.filter(mention => {
                const mentionText = newValue.slice(mention.startOffset, mention.endOffset);
                const fileName = getFileName(mention.filePath);
                return mentionText === `@${fileName}`;
            }));
            prevValueRef.current = newValue;
        }
    }, []);

    const closeSuggestions = useCallback(() => {
        setSuggestionState(INITIAL_SUGGESTION_STATE);
    }, []);

    const selectFile = useCallback((filePath: string) => {
        if (disabled) return;

        const { triggerPosition, query } = suggestionState;
        const fileName = getFileName(filePath);

        // Build new value: text before @ + @filename + text after query
        const beforeTrigger = value.slice(0, triggerPosition);
        const afterQuery = value.slice(triggerPosition + 1 + query.length);
        const mention = `@${fileName}`;
        const newValue = beforeTrigger + mention + afterQuery;

        // Track this mention as menu-selected
        const newMention: FileMention = {
            filePath,
            startOffset: triggerPosition,
            endOffset: triggerPosition + mention.length,
            selectedFromMenu: true,
        };

        setMentions(prev => [...prev, newMention]);
        onChange(newValue);
        closeSuggestions();

        // Restore focus and cursor position
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newCursorPos = triggerPosition + mention.length;
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 0);
    }, [value, onChange, suggestionState, disabled, closeSuggestions]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const cursorPos = e.target.selectionStart;

        // First, call the original onChange
        onChange(newValue);

        // Clean mentions synchronously
        cleanMentions(newValue);

        if (disabled) {
            closeSuggestions();
            return;
        }

        // Check for @ trigger
        // Look backwards from cursor to find the most recent @
        let atPos = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            const char = newValue[i];
            if (char === '@') {
                atPos = i;
                break;
            }
            // Stop if we hit a space or newline (@ must be at word start or alone)
            if (char === ' ' || char === '\n' || char === '\t') {
                break;
            }
        }

        if (atPos >= 0 && (atPos === 0 || /\s/.test(newValue[atPos - 1]))) {
            // We have a valid @ trigger
            const query = newValue.slice(atPos + 1, cursorPos);

            // Only show suggestions if query doesn't contain spaces
            if (!query.includes(' ') && !query.includes('\n')) {
                setSuggestionState({
                    isOpen: true,
                    query,
                    triggerPosition: atPos,
                    selectedIndex: 0,
                });
                return;
            }
        }

        // No valid @ trigger found, close suggestions
        if (suggestionState.isOpen) {
            closeSuggestions();
        }
    }, [onChange, disabled, suggestionState.isOpen, closeSuggestions, cleanMentions]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
        if (!suggestionState.isOpen || filteredFiles.length === 0) {
            return false;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSuggestionState(prev => ({
                    ...prev,
                    selectedIndex: (prev.selectedIndex + 1) % filteredFiles.length,
                }));
                return true;

            case 'ArrowUp':
                e.preventDefault();
                setSuggestionState(prev => ({
                    ...prev,
                    selectedIndex: prev.selectedIndex === 0
                        ? filteredFiles.length - 1
                        : prev.selectedIndex - 1,
                }));
                return true;

            case 'Enter':
                if (!e.shiftKey) {
                    e.preventDefault();
                    const selectedFile = filteredFiles[safeSelectedIndex];
                    if (selectedFile) {
                        selectFile(selectedFile);
                    }
                    return true;
                }
                break;

            case 'Escape':
                e.preventDefault();
                closeSuggestions();
                return true;

            case 'Tab':
                // Close on tab but don't prevent default
                closeSuggestions();
                return false;
        }

        return false;
    }, [suggestionState.isOpen, filteredFiles, safeSelectedIndex, selectFile, closeSuggestions]);

    // Return computed selected index in state for rendering
    const effectiveSuggestionState = useMemo(() => ({
        ...suggestionState,
        selectedIndex: safeSelectedIndex,
    }), [suggestionState, safeSelectedIndex]);

    return {
        suggestionState: effectiveSuggestionState,
        filteredFiles,
        mentions,
        handleKeyDown,
        handleChange,
        selectFile,
        closeSuggestions,
        setTextareaRef,
    };
}

export { getFileName };
