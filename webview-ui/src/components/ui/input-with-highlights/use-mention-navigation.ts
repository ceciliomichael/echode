import { useCallback } from 'react';
import type { RefObject } from 'react';
import { findMentions, getMentionAtPosition, getMentionBeforePosition } from './utils';

interface UseMentionNavigationParams {
    value: string;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onValueChange?: (newValue: string, newCursorPos: number) => void;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * Hook that handles keyboard navigation for mentions
 * Handles Backspace, Delete, ArrowLeft, ArrowRight to treat mentions as atomic units
 */
export function useMentionNavigation({
    value,
    onKeyDown,
    onValueChange,
    textareaRef
}: UseMentionNavigationParams) {
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current;
        if (!textarea) {
            onKeyDown(e);
            return;
        }

        const cursorPos = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;
        const hasSelection = cursorPos !== selectionEnd;

        // Backspace: delete whole mention if at end of one
        if (e.key === 'Backspace' && !hasSelection) {
            const mentionBefore = getMentionBeforePosition(value, cursorPos);
            if (mentionBefore) {
                e.preventDefault();
                const newValue = value.slice(0, mentionBefore.start) + value.slice(mentionBefore.end);
                if (onValueChange) {
                    onValueChange(newValue, mentionBefore.start);
                }
                return;
            }
            // Also check if cursor is inside a mention
            const mentionAt = getMentionAtPosition(value, cursorPos);
            if (mentionAt) {
                e.preventDefault();
                const newValue = value.slice(0, mentionAt.start) + value.slice(mentionAt.end);
                if (onValueChange) {
                    onValueChange(newValue, mentionAt.start);
                }
                return;
            }
        }

        // Delete: delete whole mention if at start of one
        if (e.key === 'Delete' && !hasSelection) {
            const mentions = findMentions(value);
            for (const mention of mentions) {
                if (cursorPos === mention.start) {
                    e.preventDefault();
                    const newValue = value.slice(0, mention.start) + value.slice(mention.end);
                    if (onValueChange) {
                        onValueChange(newValue, mention.start);
                    }
                    return;
                }
            }
        }

        // Arrow Left: skip over mention if inside or at end of one
        if (e.key === 'ArrowLeft' && !hasSelection && !e.shiftKey) {
            const mentionBefore = getMentionBeforePosition(value, cursorPos);
            if (mentionBefore) {
                e.preventDefault();
                textarea.setSelectionRange(mentionBefore.start, mentionBefore.start);
                return;
            }
            const mentionAt = getMentionAtPosition(value, cursorPos);
            if (mentionAt) {
                e.preventDefault();
                textarea.setSelectionRange(mentionAt.start, mentionAt.start);
                return;
            }
        }

        // Arrow Right: skip over mention if at start or inside one
        if (e.key === 'ArrowRight' && !hasSelection && !e.shiftKey) {
            const mentions = findMentions(value);
            for (const mention of mentions) {
                if (cursorPos >= mention.start && cursorPos < mention.end) {
                    e.preventDefault();
                    textarea.setSelectionRange(mention.end, mention.end);
                    return;
                }
            }
        }

        // Pass through to original handler
        onKeyDown(e);
    }, [value, onKeyDown, onValueChange, textareaRef]);

    const handleClick = useCallback((_e: React.MouseEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // If user is selecting text (dragging), don't interfere
        if (textarea.selectionStart !== textarea.selectionEnd) {
            return;
        }

        const cursorPos = textarea.selectionStart;
        
        // Check if we clicked inside a mention
        const mention = getMentionAtPosition(value, cursorPos);
        
        if (mention) {
            // Only move if we are strictly inside (not at edges)
            if (cursorPos > mention.start && cursorPos < mention.end) {
                // Calculate nearest edge
                const mid = (mention.start + mention.end) / 2;
                const newPos = cursorPos < mid ? mention.start : mention.end;
                
                // Move cursor
                textarea.setSelectionRange(newPos, newPos);
            }
        }
    }, [value, textareaRef]);

    return { handleKeyDown, handleClick };
}