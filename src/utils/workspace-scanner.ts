import * as fs from 'fs';
import * as path from 'path';
import { parseGitignore, matchesGitignorePattern } from '../constants/excluded-patterns';

import { EXCLUDED_DIRECTORIES as PATTERNS_EXCLUDED_DIRS, EXCLUDED_FILES as PATTERNS_EXCLUDED_FILES } from '../constants/excluded-patterns';

const EXCLUDED_DIRECTORIES = PATTERNS_EXCLUDED_DIRS.map((dir) => dir.toLowerCase());

const EXCLUDED_FILES = PATTERNS_EXCLUDED_FILES
  .filter(f => !f.startsWith('*')) // Filter out glob patterns for exact matching
  .map((file) => file.toLowerCase());

// File extension patterns (e.g., *.pyc)
const EXCLUDED_EXTENSIONS = PATTERNS_EXCLUDED_FILES
  .filter(f => f.startsWith('*.'))
  .map(f => f.slice(1).toLowerCase()); // Remove * prefix

// Cache for gitignore patterns per workspace
const gitignoreCache = new Map<string, string[]>();

/**
 * Get gitignore patterns for a workspace (cached)
 */
function getGitignorePatterns(workspacePath: string): string[] {
  if (!gitignoreCache.has(workspacePath)) {
    gitignoreCache.set(workspacePath, parseGitignore(workspacePath));
  }
  return gitignoreCache.get(workspacePath) || [];
}

/**
 * Clear gitignore cache (useful when .gitignore changes)
 * Also clears the workspaceExcludedDirs cache
 */
export function clearGitignoreCache(): void {
  gitignoreCache.clear();
  workspaceExcludedDirs.clear();
}

/**
 * Check if a file or directory should be excluded from scanning
 */
export function shouldExclude(name: string, isDirectory: boolean, workspacePath?: string, relativePath?: string): boolean {
  const normalizedName = name.toLowerCase();

  if (isDirectory && EXCLUDED_DIRECTORIES.includes(normalizedName)) {
    return true;
  }
  if (!isDirectory && EXCLUDED_FILES.includes(normalizedName)) {
    return true;
  }
  // Check extension patterns
  const lowerName = name.toLowerCase();
  for (const ext of EXCLUDED_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return true;
    }
  }

  // Check gitignore patterns if workspace path is provided
  if (workspacePath) {
    const gitignorePatterns = getGitignorePatterns(workspacePath);
    const pathToCheck = relativePath || name;
    if (matchesGitignorePattern(pathToCheck, gitignorePatterns)) {
      return true;
    }
  }

  return false;
}

/**
 * Read AGENTS.md file from workspace root if it exists
 */
export function getAgentsConfig(workspacePath: string): string | null {
  try {
    const agentsPath = path.join(workspacePath, 'AGENTS.md');
    if (fs.existsSync(agentsPath)) {
      return fs.readFileSync(agentsPath, 'utf8');
    }
  } catch (error) {
    // File doesn't exist or can't be read
  }
  return null;
}

/**
 * Recursively scan workspace directory and return list of files
 */
export function getWorkspaceFiles(workspacePath: string): string[] {
  const files: string[] = [];

  const traverse = (dir: string, relativePath: string = '') => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (shouldExclude(entry.name, entry.isDirectory(), workspacePath, relPath)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          traverse(fullPath, relPath);
        } else {
          files.push(relPath);
        }
      }
    } catch (_error) {
      // Skip directories that can't be read
    }
  };

  traverse(workspacePath);
  return files.sort();
}

/**
 * File info for refactor scanning
 */
export interface LargeFileInfo {
  path: string;
  lineCount: number;
}

/**
 * Code file extensions to scan for refactoring
 */
const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.java', '.kt', '.kts', '.scala',
  '.cs', '.fs', '.vb',
  '.go',
  '.rs',
  '.rb', '.erb',
  '.php',
  '.swift',
  '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
  '.lua',
  '.dart',
  '.ex', '.exs',
  '.vue', '.svelte',
  '.astro',
];

/**
 * Check if file is a code file based on extension
 */
function isCodeFile(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return CODE_EXTENSIONS.includes(ext);
}

/**
 * Count lines if file is large enough, returns 0 if too small or error
 * Uses stat first (cheap) to avoid reading small files
 */
function countLinesIfLarge(filePath: string, minBytes: number, threshold: number): number {
  try {
    // stat is much cheaper than reading - skip small files early
    const stat = fs.statSync(filePath);
    if (stat.size < minBytes) {
      return 0;
    }

    const buffer = fs.readFileSync(filePath);
    let count = 1;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 10) {
        count++;
      }
    }
    return count >= threshold ? count : 0;
  } catch (_error) {
    return 0;
  }
}

// Pre-compute excluded directory set for O(1) lookup
const EXCLUDED_DIR_SET = new Set(EXCLUDED_DIRECTORIES);

// Cache for workspace-specific exclusion sets (includes gitignore)
const workspaceExcludedDirs = new Map<string, Set<string>>();

/**
 * Get excluded directories set for a workspace (includes gitignore)
 */
function getExcludedDirsForWorkspace(workspacePath: string): Set<string> {
  if (!workspaceExcludedDirs.has(workspacePath)) {
    const dirs = new Set(EXCLUDED_DIRECTORIES);

    // Parse gitignore and add directory patterns
    const gitignorePatterns = getGitignorePatterns(workspacePath);
    for (const pattern of gitignorePatterns) {
      // Simple directory patterns (no wildcards, no slashes)
      const clean = pattern.replace(/^\/|\/$/g, '').toLowerCase();
      if (!clean.includes('*') && !clean.includes('/')) {
        dirs.add(clean);
      }
    }

    workspaceExcludedDirs.set(workspacePath, dirs);
  }
  return workspaceExcludedDirs.get(workspacePath)!;
}

/**
 * Fast exclusion check with gitignore support
 */
function shouldExcludeFast(name: string, isDirectory: boolean, excludedDirs: Set<string>): boolean {
  const lower = name.toLowerCase();

  if (isDirectory) {
    return excludedDirs.has(lower);
  }

  // Check extension patterns for files
  for (const ext of EXCLUDED_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Scan workspace for large files that may need refactoring
 * @param workspacePath - Path to workspace root
 * @param threshold - Line count threshold (default 300)
 */
export async function scanLargeFilesAsync(workspacePath: string, threshold: number = 300): Promise<LargeFileInfo[]> {
  const largeFiles: LargeFileInfo[] = [];
  const minBytes = threshold * 20;
  const excludedDirs = getExcludedDirsForWorkspace(workspacePath);

  const traverse = (dir: string, relativePath: string = '') => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_error) {
      return;
    }

    for (const entry of entries) {
      const name = entry.name;

      if (shouldExcludeFast(name, entry.isDirectory(), excludedDirs)) {
        continue;
      }

      const fullPath = path.join(dir, name);
      const relPath = relativePath ? `${relativePath}/${name}` : name;

      if (entry.isDirectory()) {
        traverse(fullPath, relPath);
      } else if (isCodeFile(name)) {
        const lineCount = countLinesIfLarge(fullPath, minBytes, threshold);
        if (lineCount > 0) {
          largeFiles.push({ path: relPath, lineCount });
        }
      }
    }
  };

  traverse(workspacePath);
  return largeFiles.sort((a, b) => b.lineCount - a.lineCount);
}

/**
 * Scan workspace for large files (sync version)
 */
export function scanLargeFiles(workspacePath: string, threshold: number = 300): LargeFileInfo[] {
  const largeFiles: LargeFileInfo[] = [];
  const minBytes = threshold * 20;
  const excludedDirs = getExcludedDirsForWorkspace(workspacePath);

  const traverse = (dir: string, relativePath: string = '') => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_error) {
      return;
    }

    for (const entry of entries) {
      const name = entry.name;

      if (shouldExcludeFast(name, entry.isDirectory(), excludedDirs)) {
        continue;
      }

      const fullPath = path.join(dir, name);
      const relPath = relativePath ? `${relativePath}/${name}` : name;

      if (entry.isDirectory()) {
        traverse(fullPath, relPath);
      } else if (isCodeFile(name)) {
        const lineCount = countLinesIfLarge(fullPath, minBytes, threshold);
        if (lineCount > 0) {
          largeFiles.push({ path: relPath, lineCount });
        }
      }
    }
  };

  traverse(workspacePath);
  return largeFiles.sort((a, b) => b.lineCount - a.lineCount);
}
