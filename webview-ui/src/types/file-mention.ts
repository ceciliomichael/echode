/**
 * File Mention Types
 * Used for @file.ext autocomplete feature in chat input
 */

/**
 * Represents a file mention in the text input
 */
export interface FileMention {
    /** Full file path relative to workspace */
    filePath: string;
    /** Start offset in text (inclusive) */
    startOffset: number;
    /** End offset in text (exclusive) */
    endOffset: number;
    /** True if selected from the dropdown menu (should be highlighted blue) */
    selectedFromMenu: boolean;
}

/**
 * State for the file mention suggestion dropdown
 */
export interface FileMentionSuggestionState {
    /** Whether the suggestion dropdown is visible */
    isOpen: boolean;
    /** Query string after @ (for filtering) */
    query: string;
    /** Cursor position when @ was typed (for positioning dropdown) */
    triggerPosition: number;
    /** Currently highlighted index in the suggestion list */
    selectedIndex: number;
}
