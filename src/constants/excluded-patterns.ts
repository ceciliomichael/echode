import * as fs from 'fs';
import * as path from 'path';

export const EXCLUDED_DIRECTORIES = [
  // JavaScript/TypeScript/Node
  'node_modules',
  '.next',
  '.nuxt',
  '.output',
  '.vercel',
  '.netlify',
  
  // Python
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.env',
  '.pytest_cache',
  '.mypy_cache',
  '.tox',
  '.eggs',
  'egg-info',
  '.ipynb_checkpoints',
  
  // Version Control
  '.git',
  '.svn',
  '.hg',
  
  // Build outputs
  'dist',
  'build',
  'builds',
  'out',
  'output',
  '_build',
  
  // Rust
  'target',
  
  // Go
  'vendor',
  
  // Java/Kotlin/Scala
  '.gradle',
  '.mvn',
  '.m2',
  
  // .NET/C#
  'bin',
  'obj',
  'packages',
  '.nuget',
  
  // C/C++
  'cmake-build-debug',
  'cmake-build-release',
  'cmake-build-*',
  
  // Ruby
  '.bundle',
  
  // Elixir/Erlang
  'deps',
  '_build',
  '.elixir_ls',
  
  // Dart/Flutter
  '.dart_tool',
  '.pub-cache',
  
  // Swift/iOS
  '.build',
  'DerivedData',
  'Pods',
  '.swiftpm',
  
  // IDE/Editor
  '.idea',
  '.vscode',
  '.vs',
  '.fleet',
  
  // Testing/Coverage
  'coverage',
  '.nyc_output',
  'htmlcov',
  
  // Misc
  '.cache',
  '.temp',
  '.tmp',
  'tmp',
  'temp',
  'logs',
  '.sass-cache',
  '.parcel-cache',
  '.turbo',
  '.webpack',
  '.docusaurus',
  '.storybook-out',
];

export const EXCLUDED_FILES = [
  // OS files
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
  
  // Compiled/Binary
  '*.pyc',
  '*.pyo',
  '*.pyd',
  '*.so',
  '*.dll',
  '*.dylib',
  '*.class',
  '*.o',
  '*.obj',
  '*.exe',
  '*.jar',
  '*.war',
  '*.ear',
  '*.nupkg',
  '*.whl',
  '*.egg',
  
  // Logs/Temp
  '*.log',
  '*.tmp',
  '*.temp',
  '*.swp',
  '*.swo',
  '*.bak',
  '*.cache',
  
  // Lock files
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
  'poetry.lock',
  'Pipfile.lock',
  'go.sum',
  'pubspec.lock',
  'Podfile.lock',
  'packages.lock.json',
  
  // Source maps
  '*.map',
  '*.js.map',
  '*.css.map',
  
  // Minified files
  '*.min.js',
  '*.min.css',
  
  // Environment
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  
  // Generated
  '*.generated.*',
  '*.g.dart',
  '*.freezed.dart',
  
  // Special
  'AGENTS.md',
];

export function getDefaultGrepExcludes(): string[] {
  const dirPatterns = EXCLUDED_DIRECTORIES.map(dir => `**/${dir}/**`);
  const filePatterns = EXCLUDED_FILES;
  return [...dirPatterns, ...filePatterns];
}

/**
 * Parse .gitignore file and return patterns
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
 * Get combined exclude patterns including .gitignore contents
 */
export function getExcludePatternsWithGitignore(workspacePath: string): string[] {
  const defaultExcludes = getDefaultGrepExcludes();
  const gitignorePatterns = parseGitignore(workspacePath);
  const globPatterns = gitignorePatternsToGlob(gitignorePatterns);
  
  // Combine and deduplicate
  const combined = [...new Set([...defaultExcludes, ...globPatterns])];
  return combined;
}

/**
 * Check if a path matches any gitignore pattern
 */
export function matchesGitignorePattern(filePath: string, patterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const segments = normalizedPath.split('/');
  
  for (const pattern of patterns) {
    // Simple pattern matching
    const cleanPattern = pattern.replace(/\/+$/, '');
    
    // Check if any segment matches the pattern
    for (const segment of segments) {
      if (matchSimpleGlob(segment, cleanPattern)) {
        return true;
      }
    }
    
    // Check if full path matches
    if (matchSimpleGlob(normalizedPath, cleanPattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Simple glob matching for gitignore patterns
 */
function matchSimpleGlob(text: string, pattern: string): boolean {
  // Handle exact match
  if (pattern === text) {
    return true;
  }
  
  // Handle wildcard patterns like *.log
  if (pattern.startsWith('*')) {
    const suffix = pattern.slice(1);
    return text.endsWith(suffix);
  }
  
  // Handle patterns like dir/*
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return text.startsWith(prefix + '/');
  }
  
  // Handle directory patterns
  if (pattern.endsWith('/')) {
    return text === pattern.slice(0, -1) || text.startsWith(pattern);
  }
  
  return false;
}
