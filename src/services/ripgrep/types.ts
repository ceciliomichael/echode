/**
 * Ripgrep type definitions
 */

// Internal types used for parsing ripgrep JSON output
export interface SearchFileResult {
    file: string;
    searchResults: SearchResult[];
}

export interface SearchResult {
    lines: SearchLineResult[];
}

export interface SearchLineResult {
    line: number;
    text: string;
    isMatch: boolean;
    column?: number;
}

// Exported types for frontend UI rendering
export interface GrepMatch {
    line: number;
    column: number;
    text: string;
    matchText: string;
}

export interface GrepFileResult {
    file: string;
    matches: GrepMatch[];
}

export interface GrepSearchResult {
    results: GrepFileResult[];
    formattedString: string;
    totalMatches: number;
    filesWithMatches: number;
}