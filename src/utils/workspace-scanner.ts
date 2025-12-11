import * as fs from 'fs';
import * as path from 'path';
import { parseGitignore, matchesGitignorePattern } from '../constants/excluded-patterns';

// Cache for gitignore patterns per workspace
interface GitignoreContext {
  basePath: string; // Relative path from workspace root
  patterns: string[];
}

// Cache for gitignore contexts
const gitignoreCache = new Map<string, string[]>();

function getGitignorePatterns(dirPath: string): string[] {
  if (!gitignoreCache.has(dirPath)) {
    gitignoreCache.set(dirPath, parseGitignore(dirPath));
  }
  return gitignoreCache.get(dirPath) || [];
}

/**
 * Clear gitignore cache (useful when .gitignore changes)
 */
export function clearGitignoreCache(): void {
  gitignoreCache.clear();
}

/**
 * Check if a file or directory should be excluded from scanning
 * Uses nested gitignore contexts
 */
export function shouldExclude(
  name: string,
  isDirectory: boolean,
  relativePath: string,
  contexts: GitignoreContext[]
): boolean {
  if (name.toLowerCase() === '.git') return true;

  // Check against all active gitignore contexts
  for (const context of contexts) {
    let relToContext: string;

    if (context.basePath === '') {
      relToContext = relativePath || name;
    } else {
      const relPathNorm = (relativePath || name).replace(/\\/g, '/');
      const baseNorm = context.basePath.replace(/\\/g, '/');

      if (relPathNorm === baseNorm || relPathNorm.startsWith(baseNorm + '/')) {
        // e.g. base='src', file='src/foo' -> 'foo'
        relToContext = relPathNorm.slice(baseNorm.length + 1);
      } else {
        continue;
      }
    }

    if (matchesGitignorePattern(relToContext, context.patterns)) {
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

  const traverse = (dir: string, relativePath: string = '', contexts: GitignoreContext[]) => {
    // Check for .gitignore in this directory and add to contexts
    let localContexts = contexts;

    // For root, contexts is passed in as [] usually, but we want to initialize if empty?
    // Actually we handle root init outside or inside?
    // Let's handle inside specific to directory.

    // If relativePath is '', we are at root (workspacePath).
    // If relativePath is 'src', dir is workspacePath/src.

    try {
      const patterns = getGitignorePatterns(dir);
      if (patterns.length > 0) {
        localContexts = [...contexts, { basePath: relativePath, patterns }];
      }
    } catch { }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        // Skip hidden files (except .gitignore)
        if (entry.name.startsWith('.') && entry.name !== '.gitignore') {
          continue;
        }

        if (shouldExclude(entry.name, entry.isDirectory(), relPath, localContexts)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          traverse(fullPath, relPath, localContexts);
        } else {
          files.push(relPath);
        }
      }
    } catch (_error) {
      // Skip directories that can't be read
    }
  };

  traverse(workspacePath, '', []);
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



/**
 * Scan workspace for large files that may need refactoring
 * @param workspacePath - Path to workspace root
 * @param threshold - Line count threshold (default 300)
 */
export async function scanLargeFilesAsync(workspacePath: string, threshold: number = 300): Promise<LargeFileInfo[]> {
  const largeFiles: LargeFileInfo[] = [];
  const minBytes = threshold * 20;

  const traverse = (dir: string, relativePath: string = '', contexts: GitignoreContext[]) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_error) {
      return;
    }

    // Update contexts
    let localContexts = contexts;
    try {
      const patterns = getGitignorePatterns(dir);
      if (patterns.length > 0) {
        localContexts = [...contexts, { basePath: relativePath, patterns }];
      }
    } catch { }

    for (const entry of entries) {
      const name = entry.name;
      const relPath = relativePath ? `${relativePath}/${name}` : name;

      if (shouldExclude(name, entry.isDirectory(), relPath, localContexts)) {
        continue;
      }

      const fullPath = path.join(dir, name);

      if (entry.isDirectory()) {
        traverse(fullPath, relPath, localContexts);
      } else if (isCodeFile(name)) {
        const lineCount = countLinesIfLarge(fullPath, minBytes, threshold);
        if (lineCount > 0) {
          largeFiles.push({ path: relPath, lineCount });
        }
      }
    }
  };

  traverse(workspacePath, '', []);
  return largeFiles.sort((a, b) => b.lineCount - a.lineCount);
}

/**
 * Scan workspace for large files (sync version)
 */
export function scanLargeFiles(workspacePath: string, threshold: number = 300): LargeFileInfo[] {
  const largeFiles: LargeFileInfo[] = [];
  const minBytes = threshold * 20;

  const traverse = (dir: string, relativePath: string = '', contexts: GitignoreContext[]) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_error) {
      return;
    }

    // Update contexts
    let localContexts = contexts;
    try {
      const patterns = getGitignorePatterns(dir);
      if (patterns.length > 0) {
        localContexts = [...contexts, { basePath: relativePath, patterns }];
      }
    } catch { }

    for (const entry of entries) {
      const name = entry.name;
      const relPath = relativePath ? `${relativePath}/${name}` : name;

      if (shouldExclude(name, entry.isDirectory(), relPath, localContexts)) {
        continue;
      }

      const fullPath = path.join(dir, name);

      if (entry.isDirectory()) {
        traverse(fullPath, relPath, localContexts);
      } else if (isCodeFile(name)) {
        const lineCount = countLinesIfLarge(fullPath, minBytes, threshold);
        if (lineCount > 0) {
          largeFiles.push({ path: relPath, lineCount });
        }
      }
    }
  };

  traverse(workspacePath, '', []);
  return largeFiles.sort((a, b) => b.lineCount - a.lineCount);
}
