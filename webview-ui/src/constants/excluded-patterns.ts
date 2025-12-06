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

  // PHP

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

  // Generated
  '*.generated.*',
  '*.g.dart',
  '*.freezed.dart',
];