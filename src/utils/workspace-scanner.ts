import * as fs from 'fs';
import * as path from 'path';

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
];

const EXCLUDED_FILES = [
  '.DS_Store',
  'Thumbs.db',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

/**
 * Check if a file or directory should be excluded from scanning
 */
function shouldExclude(name: string, isDirectory: boolean): boolean {
  if (isDirectory && EXCLUDED_DIRECTORIES.includes(name)) {
    return true;
  }
  if (!isDirectory && EXCLUDED_FILES.includes(name)) {
    return true;
  }
  if (name.endsWith('.pyc') || name.endsWith('.pyo') || name.endsWith('.pyd')) {
    return true;
  }
  if (name.endsWith('.log') || name.endsWith('.tmp') || name.endsWith('.swp')) {
    return true;
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
        if (shouldExclude(entry.name, entry.isDirectory())) {
          continue;
        }
        
        const fullPath = path.join(dir, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          traverse(fullPath, relPath);
        } else {
          files.push(relPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  };
  
  traverse(workspacePath);
  return files.sort();
}
