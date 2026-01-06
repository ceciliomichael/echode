import { useCallback, useMemo } from 'react';
import type { RefObject } from 'react';
import { findMentions, getMentionAtPosition, getMentionBeforePosition } from './utils';

interface UseMentionNavigationParams {
    value: string;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onValueChange?: (newValue: string, newCursorPos: number) => void;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    /** Valid workflow names for slash commands - only these are treated as atomic blocks */
    validWorkflowNames?: string[];
    /** Valid mention labels for @ mentions - only these are treated as atomic blocks */
    validMentionLabels?: string[];
}

/**
 * Hook that handles keyboard navigation for mentions
 * Handles Backspace, Delete, ArrowLeft, ArrowRight to treat mentions as atomic units
 * Only treats VALID mentions as atomic - invalid ones behave like normal text
 */
export function useMentionNavigation({
    value,
    onKeyDown,
    onValueChange,
    textareaRef,
    validWorkflowNames,
    validMentionLabels
}: UseMentionNavigationParams) {
    // Memoize validation options to avoid recreating on each render
    const validationOptions = useMemo(() => ({
        validWorkflowNames,
        validMentionLabels
    }), [validWorkflowNames, validMentionLabels]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current;
        if (!textarea) {
            onKeyDown(e);
            return;
        }

        const cursorPos = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;
        const hasSelection = cursorPos !== selectionEnd;

        // Backspace: delete whole mention if at end of one (only for VALID mentions)
        if (e.key === 'Backspace' && !hasSelection) {
            const mentionBefore = getMentionBeforePosition(value, cursorPos, validationOptions);
            if (mentionBefore) {
                e.preventDefault();
                const newValue = value.slice(0, mentionBefore.start) + value.slice(mentionBefore.end);
                if (onValueChange) {
                    onValueChange(newValue, mentionBefore.start);
                }
                return;
            }
            // Also check if cursor is inside a mention
            const mentionAt = getMentionAtPosition(value, cursorPos, validationOptions);
            if (mentionAt) {
                e.preventDefault();
                const newValue = value.slice(0, mentionAt.start) + value.slice(mentionAt.end);
                if (onValueChange) {
                    onValueChange(newValue, mentionAt.start);
                }
                return;
            }
        }

        // Delete: delete whole mention if at start of one (only for VALID mentions)
        if (e.key === 'Delete' && !hasSelection) {
            const mentions = findMentions(value, validationOptions);
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

        // Arrow Left: skip over mention if inside or at end of one (only for VALID mentions)
        if (e.key === 'ArrowLeft' && !hasSelection && !e.shiftKey) {
            const mentionBefore = getMentionBeforePosition(value, cursorPos, validationOptions);
            if (mentionBefore) {
                e.preventDefault();
                textarea.setSelectionRange(mentionBefore.start, mentionBefore.start);
                return;
            }
            const mentionAt = getMentionAtPosition(value, cursorPos, validationOptions);
            if (mentionAt) {
                e.preventDefault();
                textarea.setSelectionRange(mentionAt.start, mentionAt.start);
                return;
            }
        }

        // Arrow Right: skip over mention if at start or inside one (only for VALID mentions)
        if (e.key === 'ArrowRight' && !hasSelection && !e.shiftKey) {
            const mentions = findMentions(value, validationOptions);
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
    }, [value, onKeyDown, onValueChange, textareaRef, validationOptions]);

    const handleClick = useCallback((_e: React.MouseEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // If user is selecting text (dragging), don't interfere
        if (textarea.selectionStart !== textarea.selectionEnd) {
            return;
        }

        const cursorPos = textarea.selectionStart;
        
        // Check if we clicked inside a VALID mention
        const mention = getMentionAtPosition(value, cursorPos, validationOptions);
        
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
    }, [value, textareaRef, validationOptions]);

    return { handleKeyDown, handleClick };
}