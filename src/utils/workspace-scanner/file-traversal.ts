import * as fs from 'fs';
import * as path from 'path';
import { GitignoreContext } from './types';
import { getGitignorePatterns, shouldExclude } from './gitignore-manager';
import { isExcludedFromWorkspaceContext, isAlwaysMentionable } from '../../constants/excluded-patterns';

/**
 * Recursively scan workspace directory and return list of files
 */
export function getWorkspaceFiles(workspacePath: string): string[] {
  const files: string[] = [];

  const traverse = (dir: string, relativePath: string = '', contexts: GitignoreContext[]) => {
    // Check for .gitignore in this directory and add to contexts
    let localContexts = contexts;

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
        const isMentionable = isAlwaysMentionable(entry.name);

        // Skip hidden files (except .gitignore and mentionable files)
        if (entry.name.startsWith('.') && entry.name !== '.gitignore' && !isMentionable) {
          continue;
        }

        if (!isMentionable && shouldExclude(entry.name, entry.isDirectory(), relPath, localContexts)) {
          continue;
        }

        // Skip files excluded from workspace context (but still accessible via read_file)
        if (!entry.isDirectory() && !isMentionable && isExcludedFromWorkspaceContext(entry.name)) {
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