import { 
  LANGUAGE_ICONS, 
  LANGUAGE_ID_TO_EXTENSION, 
  DEFAULT_FILE_ICON, 
  DEFAULT_CODE_ICON,
  type FileIconConfig 
} from './file-icon-config';

/**
 * Get file icon configuration based on file path or extension
 */
export function getFileIconConfig(filePath: string): FileIconConfig {
  if (!filePath) {
    return DEFAULT_FILE_ICON;
  }

  // Extract filename and extension
  const fileName = filePath.split('/').pop()?.split('\\').pop() || '';
  const extension = fileName.includes('.') 
    ? fileName.split('.').pop()?.toLowerCase() || ''
    : '';

  // Special case for files without extension but specific names
  const lowerFileName = fileName.toLowerCase();
  if (lowerFileName === 'dockerfile' || lowerFileName.startsWith('dockerfile.')) {
    return LANGUAGE_ICONS.dockerfile;
  }
  if (lowerFileName === 'makefile' || lowerFileName.startsWith('makefile.')) {
    return LANGUAGE_ICONS.makefile;
  }
  if (lowerFileName === 'go.mod') {
    return LANGUAGE_ICONS.gomod;
  }
  if (lowerFileName === 'go.sum') {
    return LANGUAGE_ICONS.gosum;
  }
  if (lowerFileName === 'go.work') {
    return LANGUAGE_ICONS.gowork;
  }

  // Special case for VS Code ignore
  if (lowerFileName === '.vscodeignore') {
    return LANGUAGE_ICONS.vscode;
  }

  // Special case for Linter/Formatter configs
  if (lowerFileName.includes('eslint')) {
    return LANGUAGE_ICONS.eslint;
  }
  if (lowerFileName.includes('prettier')) {
    return LANGUAGE_ICONS.prettier;
  }

  // Special case for Node/JS configs
  if (lowerFileName === 'package.json' || lowerFileName === 'package-lock.json') {
    return LANGUAGE_ICONS.node;
  }
  if (lowerFileName === 'tsconfig.json' || lowerFileName === 'jsconfig.json') {
    return LANGUAGE_ICONS.ts;
  }
  
  // Special case for .env files
  if (lowerFileName === '.env' || lowerFileName.startsWith('.env.')) {
    return LANGUAGE_ICONS.env;
  }

  // Special case for .gitignore and other dotfiles
  if (lowerFileName === '.gitignore') {
    return LANGUAGE_ICONS.gitignore;
  }
  if (lowerFileName === '.rprofile' || lowerFileName === '.renviron') {
    return LANGUAGE_ICONS.r;
  }
  if (lowerFileName === '.gitattributes') {
    return LANGUAGE_ICONS.gitattributes;
  }
  if (lowerFileName === '.gitmodules') {
    return LANGUAGE_ICONS.gitmodules;
  }
  
  // Special case for License
  if (lowerFileName === 'license' || lowerFileName.startsWith('license.')) {
    return LANGUAGE_ICONS.license;
  }

  // Look up by extension
  if (extension && LANGUAGE_ICONS[extension]) {
    return LANGUAGE_ICONS[extension];
  }

  // Default fallback
  return DEFAULT_FILE_ICON;
}

/**
 * Get file icon configuration based on language ID
 */
export function getLanguageIcon(languageId: string): FileIconConfig {
  const normalizedId = languageId.toLowerCase();
  
  // Direct lookup in LANGUAGE_ICONS (if languageId matches extension, e.g. 'css', 'html', 'go')
  if (LANGUAGE_ICONS[normalizedId]) {
    return LANGUAGE_ICONS[normalizedId];
  }
  
  // Map via extension
  const extension = LANGUAGE_ID_TO_EXTENSION[normalizedId];
  if (extension && LANGUAGE_ICONS[extension]) {
    return LANGUAGE_ICONS[extension];
  }
  
  // Fallback
  return { ...DEFAULT_CODE_ICON, label: languageId };
}

/**
 * Extract filename from path
 */
export function extractFileName(filePath: string): string {
  if (!filePath) return 'Unknown';
  return filePath.split('/').pop()?.split('\\').pop() || filePath;
}