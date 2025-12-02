import * as fs from 'fs';
import * as path from 'path';
import { parseGitignore, matchesGitignorePattern } from '../constants/excluded-patterns';

const EXCLUDED_DIRECTORIES = [
  'node_modules',
  '__pycache__',
  '.venv',
  'venv',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.cache',
  '.temp',
  '.tmp',
  'coverage',
  '.pytest_cache',
  '.mypy_cache',
  '.tox',
  'target',
  'bin',
  'obj',
  '.gradle',
  '.idea',
  '.vscode',
  '.vs',
].map((dir) => dir.toLowerCase());

const EXCLUDED_FILES = [
  '.DS_Store',
  'Thumbs.db',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'AGENTS.md',
].map((file) => file.toLowerCase());

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
 */
export function clearGitignoreCache(): void {
  gitignoreCache.clear();
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
  if (name.endsWith('.pyc') || name.endsWith('.pyo') || name.endsWith('.pyd')) {
    return true;
  }
  if (name.endsWith('.log') || name.endsWith('.tmp') || name.endsWith('.swp')) {
    return true;
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
