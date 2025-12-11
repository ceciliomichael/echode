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

  // Generated
  '*.generated.*',
  '*.g.dart',
  '*.freezed.dart',
];