/**
 * Standalone script to scan workspace for large files
 * Spawned as external process to avoid blocking extension host
 * 
 * Usage: node scan-large-files.js <workspacePath> [threshold]
 * Output: JSON array of { path: string, lineCount: number }
 */

import * as fs from 'fs';
import * as path from 'path';

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'dist', 'build', 'builds', 'out', 'output', '_build',
  '.next', '.nuxt', '.output', '.vercel', '.netlify',
  '__pycache__', '.venv', 'venv', 'env', '.pytest_cache', '.mypy_cache', '.tox', '.eggs', '.ipynb_checkpoints',
  'target', 'vendor',
  '.gradle', '.mvn', '.m2',
  'bin', 'obj', 'packages', '.nuget',
  'cmake-build-debug', 'cmake-build-release',
  '.bundle', 'deps', '.elixir_ls',
  '.dart_tool', '.pub-cache',
  '.build', 'DerivedData', 'Pods', '.swiftpm',
  '.idea', '.vscode', '.vs', '.fleet',
  'coverage', '.nyc_output', 'htmlcov',
  '.cache', '.temp', '.tmp', 'tmp', 'temp', 'logs',
  '.sass-cache', '.parcel-cache', '.turbo', '.webpack', '.docusaurus',
  '.angular', '.svelte-kit', 'storybook-static', '.expo',
  '.serverless', '.terraform', '.pulumi',
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyw',
  '.java', '.kt', '.kts', '.scala', '.groovy',
  '.cs', '.fs', '.vb',
  '.go',
  '.rs',
  '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.hxx',
  '.rb', '.erb',
  '.php',
  '.swift',
  '.m', '.mm',
  '.lua',
  '.r', '.R',
  '.jl',
  '.ex', '.exs',
  '.erl', '.hrl',
  '.clj', '.cljs', '.cljc',
  '.hs', '.lhs',
  '.ml', '.mli',
  '.dart',
  '.vue', '.svelte',
  '.elm',
  '.pl', '.pm',
  '.sh', '.bash', '.zsh',
  '.ps1', '.psm1',
]);

interface LargeFileInfo {
  path: string;
  lineCount: number;
}

function countLinesIfLarge(filePath: string, minBytes: number, threshold: number): number {
  try {
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
  } catch {
    return 0;
  }
}

function parseGitignore(workspacePath: string): Set<string> {
  const dirs = new Set<string>();
  const gitignorePath = path.join(workspacePath, '.gitignore');
  
  try {
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
          continue;
        }
        // Simple directory patterns only
        const clean = trimmed.replace(/^\/|\/$/g, '').toLowerCase();
        if (!clean.includes('*') && !clean.includes('/')) {
          dirs.add(clean);
        }
      }
    }
  } catch {
    // Ignore errors
  }
  
  return dirs;
}

function scan(workspacePath: string, threshold: number): LargeFileInfo[] {
  const largeFiles: LargeFileInfo[] = [];
  const minBytes = threshold * 20;
  
  // Merge gitignore patterns with excluded dirs
  const excludedDirs = new Set([...EXCLUDED_DIRS, ...parseGitignore(workspacePath)]);
  
  const traverse = (dir: string, relativePath: string = '') => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    
    for (const entry of entries) {
      const name = entry.name;
      const lower = name.toLowerCase();
      
      if (entry.isDirectory()) {
        if (excludedDirs.has(lower)) {
          continue;
        }
        const fullPath = path.join(dir, name);
        const relPath = relativePath ? `${relativePath}/${name}` : name;
        traverse(fullPath, relPath);
      } else {
        const ext = path.extname(name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          const fullPath = path.join(dir, name);
          const relPath = relativePath ? `${relativePath}/${name}` : name;
          const lineCount = countLinesIfLarge(fullPath, minBytes, threshold);
          if (lineCount > 0) {
            largeFiles.push({ path: relPath, lineCount });
          }
        }
      }
    }
  };
  
  traverse(workspacePath);
  return largeFiles.sort((a, b) => b.lineCount - a.lineCount);
}

// Main
const args = process.argv.slice(2);
const workspacePath = args[0];
const threshold = parseInt(args[1] || '300', 10);

if (!workspacePath) {
  console.error(JSON.stringify({ error: 'No workspace path provided' }));
  process.exit(1);
}

try {
  const results = scan(workspacePath, threshold);
  console.log(JSON.stringify(results));
} catch (err) {
  console.error(JSON.stringify({ error: String(err) }));
  process.exit(1);
}
