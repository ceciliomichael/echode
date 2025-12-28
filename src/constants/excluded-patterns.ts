import * as fs from 'fs';
import * as path from 'path';

/**
 * Files that should be excluded from workspace context display
 * but remain accessible via read_file and mentions
 */
export const WORKSPACE_CONTEXT_EXCLUDED_FILES = [
  'AGENTS.md',
];

/**
 * Files/patterns that should ALWAYS be mentionable in the chat, even if they are
 * hidden (start with .) or excluded by gitignore.
 * Supports exact matches and simple glob patterns (e.g., '.env*')
 */
export const ALWAYS_MENTIONABLE_PATTERNS = [
  '.env*',    // Matches .env, .env.local, .env.production, etc.
  'config*',  // Matches config.yaml, config.json, config.js, etc.
  'AGENTS.md',
];

/**
 * Check if a filename matches any always-mentionable pattern
 */
export function isAlwaysMentionable(filename: string): boolean {
  for (const pattern of ALWAYS_MENTIONABLE_PATTERNS) {
    if (pattern.includes('*')) {
      // Simple glob: convert to regex (only supports * wildcard)
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      if (new RegExp(`^${regexPattern}$`).test(filename)) {
        return true;
      }
    } else if (filename === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Default patterns to ignore during workspace scanning
 * These apply regardless of .gitignore existence
 */
export const DEFAULT_IGNORED_PATTERNS = [
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
  '.git',
  '.idea',
  '.vscode',
  '.DS_Store',
  '*.log',
  'tmp',
  'temp',
  'vendor',
  'target',
  'bin',
  'obj',
  '__pycache__',
  '.env',
  '.env.local',
  '.env.*',
];

/**
 * Common binary file extensions that should not be read as text
 */
export const BINARY_FILE_EXTENSIONS = new Set([
  // Java Archives
  '.jar', '.war', '.ear',
  // Executables/Libraries
  '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.a', '.lib',
  // Archives
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.rar', '.7z',
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp',
  // Audio/Video
  '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.webm',
  // Database
  '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Compiled
  '.class', '.pyc', '.pyd', '.wasm'
]);

/**
 * Check if a file appears to be binary based on extension
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_FILE_EXTENSIONS.has(ext);
}

/**
 * Check if a filename should be excluded from workspace context
 */
export function isExcludedFromWorkspaceContext(filename: string): boolean {
  const baseName = path.basename(filename);
  return WORKSPACE_CONTEXT_EXCLUDED_FILES.some(
    excluded => baseName.toLowerCase() === excluded.toLowerCase()
  );
}

/**
 * Parse .gitignore file and return patterns
 * Strictly follows .gitignore - no exceptions
 */
export function parseGitignore(workspacePath: string): string[] {
  const gitignorePath = path.join(workspacePath, '.gitignore');
  const patterns: string[] = [];

  try {
    if (!fs.existsSync(gitignorePath)) {
      return patterns;
    }

    const content = fs.readFileSync(gitignorePath, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Skip negation patterns (lines starting with !)
      if (trimmed.startsWith('!')) {
        continue;
      }

      patterns.push(trimmed);
    }
  } catch (_error) {
    // Silently fail if gitignore can't be read
  }

  return patterns;
}

/**
 * Convert gitignore patterns to glob exclude patterns
 */
export function gitignorePatternsToGlob(patterns: string[]): string[] {
  return patterns.map(pattern => {
    // Remove trailing slashes
    let p = pattern.replace(/\/+$/, '');

    // If pattern starts with /, it's relative to root
    if (p.startsWith('/')) {
      p = p.slice(1);
    }

    // If pattern doesn't have path separators or wildcards at start, match anywhere
    if (!p.includes('/') && !p.startsWith('*')) {
      return `**/${p}`;
    }

    // If it's already a glob pattern, use as-is but ensure it can match in subdirs
    if (p.includes('*')) {
      return p.startsWith('**') ? p : `**/${p}`;
    }

    return `**/${p}/**`;
  });
}

/**
 * Get exclude patterns from .gitignore
 */
export function getExcludePatternsWithGitignore(workspacePath: string): string[] {
  const gitignorePatterns = parseGitignore(workspacePath);
  return gitignorePatternsToGlob(gitignorePatterns);
}

/**
 * Check if a path matches any gitignore pattern
 */
export function matchesGitignorePattern(filePath: string, patterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of patterns) {
    if (checkPattern(normalizedPath, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a single file path matches a gitignore pattern
 */
function checkPattern(filePath: string, pattern: string): boolean {
  // 1. Remove trailing slash (indicates directory match)
  let p = pattern.trim();
  if (p.endsWith('/')) {
    p = p.slice(0, -1);
  }

  // 2. Determine if pattern is rooted (relative to .gitignore location)
  // Rooted if it starts with '/' or contains '/' (e.g., "src/dist")
  // Recursive if it has no slashes (e.g., "node_modules", "*.log")
  const isRooted = p.startsWith('/') || p.includes('/');

  if (isRooted) {
    // Clean leading slash
    if (p.startsWith('/')) {
      p = p.slice(1);
    }

    // Check for exact match or child of directory
    // Pattern "output" (was /output) should match "output" and "output/file.txt"
    // BUT should NOT match "src/output"
    if (filePath === p || filePath.startsWith(p + '/')) {
      return true;
    }

    // Pattern "dist/*.js" -> matches "dist/app.js"
    if (p.includes('*') && matchGlob(filePath, p)) {
      return true;
    }

  } else {
    // Recursive match (e.g. "node_modules", "*.log")
    // Matches "node_modules" and "src/node_modules"

    // Check match against the full path parts
    const parts = filePath.split('/');
    for (let i = 0; i < parts.length; i++) {
      // Check exact name match for directory/file
      if (matchGlob(parts[i], p)) {
        // If it's a directory match like "node_modules", it excludes everything inside
        // We assume successful match on a segment means exclusion
        return true;
      }
    }

    // Check if filename matches (e.g. *.log)
    if (matchGlob(path.basename(filePath), p)) {
      return true;
    }
  }

  return false;
}

/**
 * Simple glob matching (supports *, ?, etc via regex)
 */
function matchGlob(text: string, pattern: string): boolean {
  if (pattern === text) {
    return true;
  }

  // Convert simple glob to regex
  // Escape special regex chars except * and ?
  const regexString = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexString}$`);
  return regex.test(text);
}

