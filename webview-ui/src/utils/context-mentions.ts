/**
 * Context mentions system - adapted from Roo Code
 * Supports Problems, Add File, Add Folder context menu options
 */

import { getFileMentionSuggestions, escapeSpaces } from './mention-utils';

/**
 * Types of context menu options
 */
export const ContextMenuOptionType = {
  File: 'file',
  Folder: 'folder',
  Problems: 'problems',
  NoResults: 'noResults',
} as const;

export type ContextMenuOptionType = typeof ContextMenuOptionType[keyof typeof ContextMenuOptionType];

/**
 * A single item in the context menu
 */
export interface ContextMenuItem {
  type: ContextMenuOptionType;
  value?: string;
  label?: string;
  description?: string;
}

/**
 * Get top-level context menu options when query is empty
 */
function getTopLevelOptions(): ContextMenuItem[] {
  return [
    { type: ContextMenuOptionType.Problems, label: 'Problems', description: 'Current workspace problems' },
    { type: ContextMenuOptionType.Folder, label: 'Add Folder', description: 'Add a folder to context' },
    { type: ContextMenuOptionType.File, label: 'Add File', description: 'Add a file to context' },
  ];
}

/**
 * Get file suggestions formatted as context menu items
 */
function getFileSuggestions(
  query: string,
  workspaceFiles: string[],
  maxResults: number = 15
): ContextMenuItem[] {
  const suggestions = getFileMentionSuggestions(query, workspaceFiles, maxResults);
  
  return suggestions
    .filter(s => s.type === 'file')
    .map(s => ({
      type: ContextMenuOptionType.File,
      value: s.path,
      label: s.basename,
      description: s.path.includes('/') ? s.path.split('/').slice(0, -1).join('/') : '',
    }));
}

/**
 * Get folder suggestions formatted as context menu items
 */
function getFolderSuggestions(
  query: string,
  workspaceFiles: string[],
  maxResults: number = 15
): ContextMenuItem[] {
  // Extract unique folder paths from workspace files
  const folderSet = new Set<string>();
  
  for (const filePath of workspaceFiles) {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    
    // Add all parent folders
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i];
      folderSet.add(current);
    }
  }
  
  const folders = Array.from(folderSet);
  const normalizedQuery = query.toLowerCase();
  
  // Score and filter folders
  const scored = folders
    .map(folder => {
      const basename = folder.split('/').pop() || folder;
      const lowerPath = folder.toLowerCase();
      const lowerBasename = basename.toLowerCase();
      
      let score = 0;
      
      if (!normalizedQuery) {
        // No query: show all, prioritize shorter paths
        score = 100 - Math.min(folder.length, 100);
      } else {
        // Exact basename match
        if (lowerBasename === normalizedQuery) {
          score = 1000;
        }
        // Basename starts with query
        else if (lowerBasename.startsWith(normalizedQuery)) {
          score = 800 + (100 - lowerBasename.length);
        }
        // Basename contains query
        else if (lowerBasename.includes(normalizedQuery)) {
          score = 600 + (100 - lowerBasename.length);
        }
        // Full path starts with query
        else if (lowerPath.startsWith(normalizedQuery)) {
          score = 400 + (100 - folder.length);
        }
        // Full path contains query
        else if (lowerPath.includes(normalizedQuery)) {
          score = 200 + (100 - folder.length);
        }
        // No match
        else {
          score = -1;
        }
      }
      
      return { folder, basename, score };
    })
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
  
  return scored.map(({ folder, basename }) => ({
    type: ContextMenuOptionType.Folder,
    value: folder,
    label: basename,
    description: folder.includes('/') ? folder.split('/').slice(0, -1).join('/') : '',
  }));
}

/**
 * Get context menu options based on current state
 * 
 * @param query - Current search query (after @)
 * @param selectedType - If user has drilled into a submenu (File or Folder)
 * @param workspaceFiles - List of workspace files for suggestions
 */
export function getContextMenuOptions(
  query: string,
  selectedType: ContextMenuOptionType | null,
  workspaceFiles: string[]
): ContextMenuItem[] {
  // If user selected "Add File" - show file list
  if (selectedType === ContextMenuOptionType.File) {
    const files = getFileSuggestions(query, workspaceFiles);
    return files.length > 0 ? files : [{ type: ContextMenuOptionType.NoResults, label: 'No files found' }];
  }
  
  // If user selected "Add Folder" - show folder list
  if (selectedType === ContextMenuOptionType.Folder) {
    const folders = getFolderSuggestions(query, workspaceFiles);
    return folders.length > 0 ? folders : [{ type: ContextMenuOptionType.NoResults, label: 'No folders found' }];
  }
  
  // Empty query - show top-level options
  if (query === '') {
    return getTopLevelOptions();
  }
  
  // Query provided - filter top-level options + show matching files/folders
  const lowerQuery = query.toLowerCase();
  const results: ContextMenuItem[] = [];
  
  // Check if query matches top-level options
  if ('problems'.startsWith(lowerQuery)) {
    results.push({ type: ContextMenuOptionType.Problems, label: 'Problems', description: 'Current workspace problems' });
  }
  
  // Add matching files (higher priority for direct file search)
  const files = getFileSuggestions(query, workspaceFiles, 10);
  results.push(...files);
  
  // Add matching folders
  const folders = getFolderSuggestions(query, workspaceFiles, 5);
  results.push(...folders);
  
  return results.length > 0 ? results : [{ type: ContextMenuOptionType.NoResults, label: 'No results found' }];
}

/**
 * Insert a mention based on context menu selection
 * Only shows @filename in the text (not full path)
 */
export function insertContextMention(
  text: string,
  cursorPos: number,
  type: ContextMenuOptionType,
  value?: string
): { newText: string; newCursorPos: number } {
  const beforeCursor = text.slice(0, cursorPos);
  const afterCursor = text.slice(cursorPos);
  
  // Find the position of the last '@' symbol before the cursor
  const lastAtIndex = beforeCursor.lastIndexOf('@');
  
  let insertValue = '';
  
  if (type === ContextMenuOptionType.Problems) {
    insertValue = 'problems';
  } else if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
    // Use only basename for display, not full path
    const fullPath = value || '';
    const basename = fullPath.split('/').pop() || fullPath;
    insertValue = basename;
    // Escape spaces if needed
    if (insertValue.includes(' ') && !insertValue.includes('\\ ')) {
      insertValue = escapeSpaces(insertValue);
    }
  }
  
  let newText: string;
  let newCursorPos: number;
  
  if (lastAtIndex !== -1) {
    // Replace everything after @ with the new mention
    const beforeMention = text.slice(0, lastAtIndex);
    // Find end of current partial mention after cursor
    const afterMatch = afterCursor.match(/^[^\s]*/);
    const skipLength = afterMatch ? afterMatch[0].length : 0;
    const afterMention = afterCursor.slice(skipLength).replace(/^\s*/, '');
    
    newText = beforeMention + '@' + insertValue + ' ' + afterMention;
    newCursorPos = lastAtIndex + 1 + insertValue.length + 1;
  } else {
    // Insert at cursor position
    newText = beforeCursor + '@' + insertValue + ' ' + afterCursor;
    newCursorPos = cursorPos + 1 + insertValue.length + 1;
  }
  
  return { newText, newCursorPos };
}

/**
 * Check if an option is selectable (not a header or no-results)
 */
export function isOptionSelectable(option: ContextMenuItem): boolean {
  return option.type !== ContextMenuOptionType.NoResults;
}
