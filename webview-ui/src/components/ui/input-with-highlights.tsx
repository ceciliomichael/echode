import React, { useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';

interface InputWithHighlightsProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    onBlur?: () => void;
    onFocus?: () => void;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
    className?: string;
    style?: React.CSSProperties;
    onValueChange?: (newValue: string, newCursorPos: number) => void;
}

export interface InputWithHighlightsRef {
    focus: () => void;
    selectionStart: number;
    selectionEnd: number;
    setSelectionRange: (start: number, end: number) => void;
    scrollHeight: number;
    style: CSSStyleDeclaration;
    value: string;
}

// Regex for @[label](path) or @[label] format mentions
import { mentionRegex } from '../../utils/context-mentions';

// Helper to find all mentions in text
function findMentions(text: string): Array<{ start: number; end: number; match: string }> {
    const mentions: Array<{ start: number; end: number; match: string }> = [];
    const regex = new RegExp(mentionRegex.source, 'g');
    let match;
    while ((match = regex.exec(text)) !== null) {
        mentions.push({
            start: match.index,
            end: match.index + match[0].length,
            match: match[0]
        });
    }
    return mentions;
}

// Find if cursor is inside a mention
function getMentionAtPosition(text: string, pos: number): { start: number; end: number; match: string } | null {
    const mentions = findMentions(text);
    for (const mention of mentions) {
        if (pos > mention.start && pos <= mention.end) {
            return mention;
        }
    }
    return null;
}

// Find mention immediately before cursor
function getMentionBeforePosition(text: string, pos: number): { start: number; end: number; match: string } | null {
    const mentions = findMentions(text);
    for (const mention of mentions) {
        if (mention.end === pos) {
            return mention;
        }
    }
    return null;
}

export const InputWithHighlights = forwardRef<InputWithHighlightsRef, InputWithHighlightsProps>(
    ({ value, onChange, onKeyDown, onPaste, onBlur, onFocus, placeholder, disabled, rows = 1, className, style, onValueChange }, ref) => {
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const backdropRef = useRef<HTMLDivElement>(null);

        useImperativeHandle(ref, () => ({
            focus: () => textareaRef.current?.focus(),
            get selectionStart() {
                return textareaRef.current?.selectionStart ?? 0;
            },
            get selectionEnd() {
                return textareaRef.current?.selectionEnd ?? 0;
            },
            setSelectionRange: (start: number, end: number) => {
                textareaRef.current?.setSelectionRange(start, end);
            },
            get scrollHeight() {
                return textareaRef.current?.scrollHeight ?? 0;
            },
            get style() {
                return textareaRef.current?.style as CSSStyleDeclaration;
            },
            get value() {
                return textareaRef.current?.value ?? '';
            }
        }));

        // Sync scroll between textarea and backdrop
        const handleScroll = () => {
            if (backdropRef.current && textareaRef.current) {
                backdropRef.current.scrollTop = textareaRef.current.scrollTop;
                backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
            }
        };

        // Auto-resize
        useEffect(() => {
            if (textareaRef.current && backdropRef.current) {
                textareaRef.current.style.height = 'auto';
                backdropRef.current.style.height = 'auto';
                const newHeight = textareaRef.current.scrollHeight;
                if (newHeight > 0) {
                    textareaRef.current.style.height = `${newHeight}px`;
                    backdropRef.current.style.height = `${newHeight}px`;
                }
            }
        }, [value]);

        // Handle special key behaviors for mentions
        const handleKeyDownInternal = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        }, [value, onKeyDown, onValueChange]);

        // Render highlights - only for @[label](path) format mentions
        const renderHighlightedContent = () => {
            if (!value) return null;

            // Parse and render with highlights
            const parts: React.ReactNode[] = [];
            let lastIndex = 0;
            let match;

            const regex = new RegExp(mentionRegex.source, 'g');

            while ((match = regex.exec(value)) !== null) {
                // Add text before this match (transparent)
                if (match.index > lastIndex) {
                    parts.push(
                        <span key={`text-${lastIndex}`} style={{ color: 'transparent' }}>
                            {value.slice(lastIndex, match.index)}
                        </span>
                    );
                }

                // Add the mention with blue background (text still transparent, just shows background)
                const fullMatch = match[0];
                parts.push(
                    <span
                        key={`mention-${match.index}`}
                        style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.25)',
                            borderRadius: '3px',
                            color: 'transparent',
                        }}
                    >
                        {fullMatch}
                    </span>
                );

                lastIndex = match.index + fullMatch.length;
            }

            // Add remaining text
            if (lastIndex < value.length) {
                parts.push(
                    <span key={`text-${lastIndex}`} style={{ color: 'transparent' }}>
                        {value.slice(lastIndex)}
                    </span>
                );
            }

            return parts.length > 0 ? parts : <span style={{ color: 'transparent' }}>{value}</span>;
        };

        // Shared base styles to ensure perfect alignment
        const baseStyles: React.CSSProperties = {
            fontFamily: 'inherit',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            lineHeight: 'inherit',
            letterSpacing: 'inherit',
            wordSpacing: 'inherit',
            textIndent: 0,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            boxSizing: 'border-box',
        };

        return (
            <div className="relative w-full">
                {/* Backdrop - shows blue background for mentions */}
                <div
                    ref={backdropRef}
                    className="absolute top-0 left-0 right-0 pointer-events-none overflow-hidden"
                    style={{
                        ...baseStyles,
                        padding: '0.25rem 0.375rem',
                        minHeight: '36px',
                        maxHeight: '100px',
                    }}
                    aria-hidden="true"
                >
                    {renderHighlightedContent()}
                </div>

                {/* Actual textarea - text is visible normally */}
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={onChange}
                    onKeyDown={handleKeyDownInternal}
                    onPaste={onPaste}
                    onBlur={onBlur}
                    onFocus={onFocus}
                    onScroll={handleScroll}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={rows}
                    className={className}
                    style={{
                        ...style,
                        ...baseStyles,
                        background: 'transparent',
                    }}
                />
            </div>
        );
    }
);

InputWithHighlights.displayName = 'InputWithHighlights';
