/**
 * Ripgrep service for Echode
 * 
 * Provides fast regex search and file listing using VSCode's bundled ripgrep binary.
 * 
 * Key features:
 * - Uses VSCode's bundled ripgrep binary
 * - JSON output parsing for structured results
 * - Context lines support
 * - Gitignore-aware by default (handles all exclusions via .gitignore)
 */

// Public API - Search functions
export { regexSearchFiles, regexSearchFilesStructured } from './regex-search';

// Public API - File listing
export { listFilesWithRipgrep } from './file-lister';

// Public API - Types
export type { GrepMatch, GrepFileResult, GrepSearchResult } from './types';