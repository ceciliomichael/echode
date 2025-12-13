/**
 * Context for gitignore pattern matching
 */
export interface GitignoreContext {
  basePath: string; // Relative path from workspace root
  patterns: string[];
}

/**
 * File info for refactor scanning
 */
export interface LargeFileInfo {
  path: string;
  lineCount: number;
}