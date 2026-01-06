import React, { useRef, useLayoutEffect, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import type { InputWithHighlightsProps, InputWithHighlightsRef } from './types';
import { useMentionNavigation } from './use-mention-navigation';
import { useScrollSync } from './use-scroll-sync';
import { HighlightRenderer } from './highlight-renderer';

/**
 * Shared base styles to ensure perfect alignment between textarea and backdrop.
 * These are baseline styles; computed styles from the textarea will override them.
 */
const baseStyles: React.CSSProperties = {
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    boxSizing: 'border-box',
};

/**
 * Style properties that need to be synchronized from textarea to backdrop
 * for perfect text alignment (font, padding, borders)
 */
const SYNC_STYLE_PROPERTIES = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'lineHeight',
    'letterSpacing',
    'wordSpacing',
    'textIndent',
    'textTransform',
    'whiteSpace',
    'wordBreak',
    'paddingTop',
    'paddingBottom',
    'paddingLeft',
    'paddingRight',
    'borderTopWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderRightWidth',
] as const;

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
        onValueChange,
        validWorkflowNames,
        validMentionLabels
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

        // Convert Map to array of keys for the navigation hook
        const validMentionLabelsArray = useMemo(
            () => validMentionLabels ? Array.from(validMentionLabels.keys()) : undefined,
            [validMentionLabels]
        );

        // Use custom hooks for behavior
        const { handleScroll, scrollOffset } = useScrollSync({ textareaRef });
        const { handleKeyDown, handleClick } = useMentionNavigation({
            value,
            onKeyDown,
            onValueChange,
            textareaRef,
            validWorkflowNames,
            validMentionLabels: validMentionLabelsArray
        });

        /**
         * Synchronize styles from textarea to backdrop.
         * This ensures the backdrop text matches the textarea exactly,
         * including font, padding, and accounting for scrollbar width.
         */
        const syncStyles = useCallback(() => {
            const textarea = textareaRef.current;
            const backdrop = backdropRef.current;
            if (!textarea || !backdrop) return;

            const computedStyle = window.getComputedStyle(textarea);

            // Copy all relevant style properties from textarea to backdrop
            // Using setProperty() to avoid TypeScript issues with CSSStyleDeclaration indexing
            for (const prop of SYNC_STYLE_PROPERTIES) {
                const cssProperty = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                const value = computedStyle.getPropertyValue(cssProperty);
                backdrop.style.setProperty(cssProperty, value);
            }

            // Sync the exact width from textarea to backdrop
            backdrop.style.width = `${textarea.offsetWidth}px`;

            // Calculate scrollbar width and add to backdrop's padding-right
            // This is CRITICAL: textarea content width is reduced by scrollbar, so backdrop must compensate
            // otherwise text in backdrop will wrap later than text in textarea
            const borderLeftWidth = parseFloat(computedStyle.borderLeftWidth) || 0;
            const borderRightWidth = parseFloat(computedStyle.borderRightWidth) || 0;
            const scrollbarWidth = textarea.offsetWidth - textarea.clientWidth - borderLeftWidth - borderRightWidth;

            if (scrollbarWidth > 0) {
                const currentPaddingRight = parseFloat(computedStyle.paddingRight) || 0;
                backdrop.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
            }
        }, []);

        // Auto-resize textarea and backdrop based on content, sync styles, then sync scroll
        // Using useLayoutEffect ensures everything syncs before paint
        useLayoutEffect(() => {
            const textarea = textareaRef.current;
            const backdrop = backdropRef.current;
            if (!textarea || !backdrop) return;

            // Sync computed styles (font, padding, borders) from textarea to backdrop
            syncStyles();

            // Auto-resize height
            textarea.style.height = 'auto';
            backdrop.style.height = 'auto';
            const newHeight = textarea.scrollHeight;
            if (newHeight > 0) {
                textarea.style.height = `${newHeight}px`;
                backdrop.style.height = `${newHeight}px`;
            }

            // Sync scroll position after resize to catch auto-scroll
            handleScroll();

            // Add ResizeObserver to sync styles on resize (e.g. window resize)
            const resizeObserver = new ResizeObserver(() => {
                syncStyles();
                handleScroll();
            });
            resizeObserver.observe(textarea);

            return () => {
                resizeObserver.disconnect();
            };
        }, [value, handleScroll, syncStyles, className, style]);

        return (
            <div className="relative w-full">
                {/* Backdrop - shows blue background for mentions */}
                {/* Styles (font, padding, etc.) are synchronized from textarea via syncStyles() */}
                <div
                    ref={backdropRef}
                    className="absolute top-0 left-0 pointer-events-none overflow-hidden"
                    style={{
                        ...baseStyles,
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
                        <HighlightRenderer 
                            value={value} 
                            validWorkflowNames={validWorkflowNames}
                            validMentionLabels={validMentionLabels}
                        />
                    </div>
                </div>

                {/* Actual textarea - text is visible normally */}
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={onChange}
                    onKeyDown={handleKeyDown}
                    onClick={handleClick}
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