/**
 * Utilities for @file mentions in chat input
 */

// Regex to match @mentions: @path/to/file or @filename.ext
// Supports escaped spaces (\ ) in paths
export const mentionRegex = /@((?:[^\s@]|\\ )+)/;
export const mentionRegexGlobal = /@((?:[^\s@]|\\ )+)/g;

/**
 * Escape spaces in a path with backslashes
 */
export function escapeSpaces(path: string): string {
  return path.replace(/ /g, '\\ ');
}

/**
 * Unescape spaces in a path (remove backslashes before spaces)
 */
export function unescapeSpaces(path: string): string {
  return path.replace(/\\ /g, ' ');
}

/**
 * Get the active mention being typed at the cursor position
 * Returns null if cursor is not within a mention
 */
export function getActiveMention(
  text: string,
  cursorPos: number
): { start: number; end: number; query: string } | null {
  const beforeCursor = text.slice(0, cursorPos);
  
  // Find the last @ before cursor
  const lastAtIndex = beforeCursor.lastIndexOf('@');
  if (lastAtIndex === -1) {return null;}
  
  // Check if there's whitespace between @ and cursor (excluding escaped spaces)
  const textAfterAt = beforeCursor.slice(lastAtIndex + 1);
  
  // If there's unescaped whitespace (space not preceded by \), no active mention
  // Check each character - allow "\ " but not standalone " "
  for (let i = 0; i < textAfterAt.length; i++) {
    if (textAfterAt[i] === ' ' && (i === 0 || textAfterAt[i - 1] !== '\\')) {
      return null;
    }
    if (textAfterAt[i] === '\n' || textAfterAt[i] === '\t') {
      return null;
    }
  }
  
  // Get the query (everything after @)
  const query = textAfterAt;
  
  // Find where the mention ends (next whitespace or end of text)
  const afterCursor = text.slice(cursorPos);
  const endMatch = afterCursor.match(/^([^\s]*)/);
  const endOffset = endMatch ? endMatch[1].length : 0;
  
  return {
    start: lastAtIndex,
    end: cursorPos + endOffset,
    query,
  };
}

// Store mention path mappings (filename -> full path)
// This allows us to display just @filename but still know the full path
const mentionPathMap = new Map<string, string>();

/**
 * Register a mention path mapping
 */
export function registerMentionPath(filename: string, fullPath: string): void {
  mentionPathMap.set(filename.toLowerCase(), fullPath);
}

/**
 * Get full path for a filename mention
 */
export function getMentionPath(filename: string): string | undefined {
  return mentionPathMap.get(filename.toLowerCase());
}

/**
 * Clear all mention path mappings
 */
export function clearMentionPaths(): void {
  mentionPathMap.clear();
}

/**
 * Insert a mention at the cursor position, replacing any partial mention
 * Only shows @filename in the text, stores path in mapping
 */
export function insertMention(
  text: string,
  cursorPos: number,
  mentionPath: string
): { newText: string; newCursorPos: number } {
  const activeMention = getActiveMention(text, cursorPos);
  
  // Get just the filename for display
  const basename = mentionPath.split('/').pop() || mentionPath;
  
  // Store the full path mapping
  registerMentionPath(basename, mentionPath);
  
  // Escape spaces in the basename
  const escapedBasename = basename.includes(' ') && !basename.includes('\\ ')
    ? escapeSpaces(basename)
    : basename;
  
  // Just @filename (clean display)
  const mentionText = `@${escapedBasename} `;
  
  if (activeMention) {
    // Replace the active mention
    const before = text.slice(0, activeMention.start);
    const after = text.slice(activeMention.end);
    const newText = before + mentionText + after;
    const newCursorPos = activeMention.start + mentionText.length;
    return { newText, newCursorPos };
  } else {
    // Insert at cursor
    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    const newText = before + mentionText + after;
    const newCursorPos = cursorPos + mentionText.length;
    return { newText, newCursorPos };
  }
}

/**
 * Remove a mention if cursor is right at the end of one (for backspace handling)
 * Only triggers when cursor is directly after @filename (no trailing space)
 */
export function removeMention(
  text: string,
  cursorPos: number
): { newText: string; newCursorPos: number } | null {
  const beforeCursor = text.slice(0, cursorPos);
  
  // Only match if cursor is right at end of mention (no trailing space)
  const mentionEndMatch = beforeCursor.match(/@([^\s@]+)$/);
  
  if (mentionEndMatch) {
    // Find where the @ starts
    const matchStart = cursorPos - mentionEndMatch[0].length;
    const afterCursor = text.slice(cursorPos);
    
    // Remove the mention and any leading space from what follows
    const newText = text.slice(0, matchStart) + afterCursor.replace(/^\s/, '');
    return {
      newText,
      newCursorPos: matchStart,
    };
  }
  
  return null;
}

export interface MentionSuggestion {
  path: string;
  type: 'file' | 'folder';
  basename: string;
  extension: string;
}

/**
 * Get file extension from path
 */
export function getFileExtension(filePath: string): string {
  const basename = filePath.split('/').pop() || filePath;
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === 0) {return '';}
  return basename.slice(dotIndex + 1).toLowerCase();
}

/**
 * Get file mention suggestions based on query
 */
export function getFileMentionSuggestions(
  query: string,
  workspaceFiles: string[],
  maxResults: number = 8
): MentionSuggestion[] {
  if (!workspaceFiles || workspaceFiles.length === 0) {
    return [];
  }
  
  // Normalize query: lowercase for matching
  const normalizedQuery = query.toLowerCase();
  
  // Score and filter files
  const scored = workspaceFiles
    .map(filePath => {
      // Normalize path separators
      const normalizedPath = filePath.replace(/\\/g, '/');
      const basename = normalizedPath.split('/').pop() || normalizedPath;
      const lowerPath = normalizedPath.toLowerCase();
      const lowerBasename = basename.toLowerCase();
      const extension = getFileExtension(normalizedPath);
      
      // Determine if it's a folder (ends with /)
      const isFolder = normalizedPath.endsWith('/');
      
      let score = 0;
      
      if (!normalizedQuery) {
        // No query: show all, prioritize shorter paths
        score = 100 - Math.min(normalizedPath.length, 100);
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
          score = 400 + (100 - normalizedPath.length);
        }
        // Full path contains query
        else if (lowerPath.includes(normalizedQuery)) {
          score = 200 + (100 - normalizedPath.length);
        }
        // No match
        else {
          score = -1;
        }
      }
      
      return {
        path: normalizedPath,
        type: isFolder ? 'folder' as const : 'file' as const,
        basename,
        extension,
        score,
      };
    })
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
  
  return scored.map(({ path, type, basename, extension }) => ({ path, type, basename, extension }));
}

/**
 * Parse all @mentions from text and return filenames
 */
export function parseMentionFilenames(text: string): string[] {
  const filenames: string[] = [];
  let match;
  
  while ((match = mentionRegexGlobal.exec(text)) !== null) {
    const filename = unescapeSpaces(match[1]);
    filenames.push(filename);
  }
  mentionRegexGlobal.lastIndex = 0;
  
  return filenames;
}

/**
 * Parse all @mentions from text and return their full paths
 * Uses the mention path map to resolve filenames to full paths
 * Falls back to filename if no mapping exists
 */
export function parseMentions(text: string, workspaceFiles?: string[]): string[] {
  const filenames = parseMentionFilenames(text);
  
  return filenames.map(filename => {
    // First check the path map
    const mappedPath = getMentionPath(filename);
    if (mappedPath) {
      return mappedPath;
    }
    
    // Try to find in workspace files by basename
    if (workspaceFiles) {
      const matchingFile = workspaceFiles.find(f => {
        const basename = f.split('/').pop() || f;
        return basename.toLowerCase() === filename.toLowerCase();
      });
      if (matchingFile) {
        return matchingFile;
      }
    }
    
    // Fallback to filename as-is
    return filename;
  });
}

/**
 * Expand @mentions in text with full paths for sending to AI
 */
export function expandMentionsForAI(text: string, workspaceFiles?: string[]): string {
  let result = text;
  let match;
  
  // Find all @mentions and replace with full paths
  const regex = /@((?:[^\s@]|\\ )+)/g;
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  
  while ((match = regex.exec(text)) !== null) {
    const filename = unescapeSpaces(match[1]);
    const fullPath = getMentionPath(filename);
    
    if (fullPath) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        replacement: `@${fullPath}`,
      });
    } else if (workspaceFiles) {
      // Try to find in workspace files
      const matchingFile = workspaceFiles.find(f => {
        const basename = f.split('/').pop() || f;
        return basename.toLowerCase() === filename.toLowerCase();
      });
      if (matchingFile) {
        replacements.push({
          start: match.index,
          end: match.index + match[0].length,
          replacement: `@${matchingFile}`,
        });
      }
    }
  }
  
  // Apply replacements in reverse order to preserve indices
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end, replacement } = replacements[i];
    result = result.slice(0, start) + replacement + result.slice(end);
  }
  
  return result;
}
