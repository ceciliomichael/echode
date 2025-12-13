import { parseGitignore, matchesGitignorePattern } from '../../constants/excluded-patterns';
import { GitignoreContext } from './types';

// Cache for gitignore patterns per directory
const gitignoreCache = new Map<string, string[]>();

/**
 * Get gitignore patterns for a directory (cached)
 */
export function getGitignorePatterns(dirPath: string): string[] {
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