// Re-export all public APIs for backward compatibility
export { GitignoreContext, LargeFileInfo } from './types';
export { clearGitignoreCache, shouldExclude } from './gitignore-manager';
export { getAgentsConfig } from './agents-config';
export { getWorkspaceFiles } from './file-traversal';
export { scanLargeFiles, scanLargeFilesAsync } from './large-file-scanner';