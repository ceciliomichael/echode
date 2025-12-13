/**
 * Types and interfaces for the apply-diff tool
 */

/**
 * Result of a diff operation
 */
export interface DiffResult {
    success: boolean;
    content?: string;
    error?: string;
    failParts?: { success: boolean; error?: string; details?: unknown }[];
    details?: unknown;
}

/**
 * Strategy interface for applying diffs
 */
export interface DiffStrategy {
    applyDiff(
        originalContent: string,
        diffContent: string,
        startLine?: number,
        endLine?: number
    ): Promise<DiffResult>;
}

/**
 * Options for string normalization
 */
export interface NormalizeOptions {
    smartQuotes?: boolean;
    typographicChars?: boolean;
    extraWhitespace?: boolean;
    trim?: boolean;
}

/**
 * Result of marker validation
 */
export interface ValidationResult {
    success: boolean;
    error?: string;
}

/**
 * Fuzzy search result
 */
export interface FuzzySearchResult {
    bestScore: number;
    bestMatchIndex: number;
    bestMatchContent: string;
}