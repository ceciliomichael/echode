export const EXCLUDED_DIRECTORIES = [
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

export const EXCLUDED_FILES = [
  '.DS_Store',
  'Thumbs.db',
  '*.pyc',
  '*.pyo',
  '*.pyd',
  '*.so',
  '*.dll',
  '*.dylib',
  '*.class',
  '*.log',
  '*.tmp',
  '*.swp',
  '*.swo',
  '*.bak',
  '*.cache',
  '*.min.js',
  '*.min.css',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

export function getDefaultGrepExcludes(): string[] {
  const dirPatterns = EXCLUDED_DIRECTORIES.map(dir => `**/${dir}/**`);
  const filePatterns = EXCLUDED_FILES;
  return [...dirPatterns, ...filePatterns];
}
