import React, { useRef, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import type { InputWithHighlightsProps, InputWithHighlightsRef } from './types';
import { useMentionNavigation } from './use-mention-navigation';
import { useScrollSync } from './use-scroll-sync';
import { HighlightRenderer } from './highlight-renderer';

/**
 * Shared base styles to ensure perfect alignment between textarea and backdrop
 */
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

/**
 * A textarea component with mention highlighting support
 * Renders @[label](path) mentions with a blue background
 * while maintaining full textarea functionality
 */
export const InputWithHighlights = forwardRef<InputWithHighlightsRef, InputWithHighlightsProps>(
    ({
        value,
        onChange,
        onKeyDown,
        onPaste,
        onBlur,
        onFocus,
        placeholder,
        disabled,
        rows = 1,
        className,
        style,
        onValueChange
    }, ref) => {
        const textareaRef = useRef<HTMLTextAreaElement>(null);
        const backdropRef = useRef<HTMLDivElement>(null);

        // Expose textarea-like interface via ref
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

        // Use custom hooks for behavior
        const { handleScroll, scrollOffset } = useScrollSync({ textareaRef });
        const { handleKeyDown } = useMentionNavigation({
            value,
            onKeyDown,
            onValueChange,
            textareaRef
        });

        // Auto-resize textarea and backdrop based on content, then sync scroll
        // Using useLayoutEffect ensures scroll sync happens before paint
        useLayoutEffect(() => {
            if (textareaRef.current && backdropRef.current) {
                textareaRef.current.style.height = 'auto';
                backdropRef.current.style.height = 'auto';
                const newHeight = textareaRef.current.scrollHeight;
                if (newHeight > 0) {
                    textareaRef.current.style.height = `${newHeight}px`;
                    backdropRef.current.style.height = `${newHeight}px`;
                }
                // Sync scroll position after resize to catch auto-scroll
                handleScroll();
            }
        }, [value, handleScroll]);

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
                    {/* Inner wrapper with transform for scroll sync */}
                    <div
                        style={{
                            transform: `translate(${-scrollOffset.left}px, ${-scrollOffset.top}px)`,
                        }}
                    >
                        <HighlightRenderer value={value} />
                    </div>
                </div>

                {/* Actual textarea - text is visible normally */}
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={onChange}
                    onKeyDown={handleKeyDown}
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