import * as fs from 'fs';
import * as path from 'path';
import { GitignoreContext, LargeFileInfo } from './types';
import { getGitignorePatterns, shouldExclude } from './gitignore-manager';

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