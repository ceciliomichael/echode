import React from 'react';

/**
 * Props for the InputWithHighlights component
 */
export interface InputWithHighlightsProps {
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
    /** Maximum height in pixels. When set, clamps the auto-resize height and enables scrolling. */
    maxHeight?: number;
}

/**
 * Ref interface for InputWithHighlights component
 * Exposes textarea-like properties for external control
 */
export interface InputWithHighlightsRef {
    focus: () => void;
    selectionStart: number;
    selectionEnd: number;
    setSelectionRange: (start: number, end: number) => void;
    scrollHeight: number;
    style: CSSStyleDeclaration;
    value: string;
}

/**
 * Represents a mention found in text
 */
export interface MentionMatch {
    start: number;
    end: number;
    match: string;
}