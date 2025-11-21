import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

export class EditFileTool implements ITool {
  name = 'edit_file';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const oldString = parameters.old_string as string;
    const newString = parameters.new_string as string;

    console.log('[EDIT_FILE] ==================== START ====================');
    console.log('[EDIT_FILE] Target file:', filePath);

    if (!filePath) {
      console.log('[EDIT_FILE] ERROR: No file path provided');
      return { success: false, error: 'File path is required' };
    }

    if (oldString === undefined) {
      console.log('[EDIT_FILE] ERROR: No old_string provided');
      return { success: false, error: 'old_string is required' };
    }

    if (newString === undefined) {
      console.log('[EDIT_FILE] ERROR: No new_string provided');
      return { success: false, error: 'new_string is required' };
    }

    if (typeof oldString !== 'string') {
      console.log('[EDIT_FILE] ERROR: old_string is not a string');
      return { success: false, error: 'old_string must be a string' };
    }

    if (typeof newString !== 'string') {
      console.log('[EDIT_FILE] ERROR: new_string is not a string');
      return { success: false, error: 'new_string must be a string' };
    }

    if (oldString === newString) {
      console.log('[EDIT_FILE] ERROR: old_string and new_string are identical');
      return { success: false, error: 'old_string and new_string must be different (no-op edit)' };
    }

    console.log('[EDIT_FILE] old_string length:', oldString.length, 'characters');
    console.log('[EDIT_FILE] new_string length:', newString.length, 'characters');
    console.log('[EDIT_FILE] old_string preview:', oldString.substring(0, 100).replace(/\n/g, '\\n'));

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        console.log('[EDIT_FILE] ERROR: No workspace folder open');
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);
      console.log('[EDIT_FILE] Absolute path:', absolutePath);

      // Read current file content
      let originalContent: string;
      try {
        const fileContent = await vscode.workspace.fs.readFile(uri);
        originalContent = Buffer.from(fileContent).toString('utf8');
        console.log('[EDIT_FILE] File read successfully, length:', originalContent.length, 'characters');
      } catch (error) {
        console.log('[EDIT_FILE] ERROR: File not found:', error);
        return {
          success: false,
          error: `FILE_NOT_FOUND: Cannot read file '${filePath}'. Verify the path is correct.`,
        };
      }

      // Count occurrences of old_string
      const occurrences = this.countOccurrences(originalContent, oldString);
      console.log('[EDIT_FILE] Found', occurrences.count, 'occurrence(s) of old_string');

      if (occurrences.count === 0) {
        console.log('[EDIT_FILE] ERROR: old_string not found in file');
        // Provide helpful context
        const similarLines = this.findSimilarContent(originalContent, oldString);
        let errorMsg = `STRING_NOT_FOUND: The exact string was not found in '${filePath}'.\n\nYou must copy the EXACT text from read_file output, including all whitespace and line breaks.`;
        
        if (similarLines.length > 0) {
          errorMsg += `\n\nSimilar content found (check whitespace/indentation):\n${similarLines.slice(0, 3).join('\n')}`;
        }
        
        errorMsg += '\n\nCall read_file again to see the current file content and copy the exact string.';
        
        return {
          success: false,
          error: errorMsg,
        };
      }

      if (occurrences.count > 1) {
        console.log('[EDIT_FILE] ERROR: old_string appears multiple times');
        const locations = occurrences.locations.slice(0, 5).map(loc => {
          const lineNum = this.getLineNumber(originalContent, loc);
          const snippet = this.getSnippet(originalContent, loc, 40);
          return `  Line ${lineNum}: ...${snippet}...`;
        }).join('\n');
        
        return {
          success: false,
          error: `STRING_AMBIGUOUS: The string appears ${occurrences.count} times in '${filePath}'. You must provide more context to make it unique.\n\nLocations:\n${locations}\n\nInclude surrounding lines or more context to uniquely identify which occurrence to replace.`,
        };
      }

      // Perform replacement
      const newContent = originalContent.replace(oldString, newString);
      console.log('[EDIT_FILE] Replacement successful');
      console.log('[EDIT_FILE] New content length:', newContent.length, 'characters');

      // Write back to file
      const contentBytes = Buffer.from(newContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      console.log('[EDIT_FILE] File written successfully');

      // Truncate for return if too large
      const MAX_CONTENT_SIZE = 1024 * 512; // 512KB
      let returnOriginal = originalContent;
      let returnNew = newContent;
      let truncated = false;

      if (originalContent.length > MAX_CONTENT_SIZE || newContent.length > MAX_CONTENT_SIZE) {
        returnOriginal = originalContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        returnNew = newContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        truncated = true;
      }

      console.log('[EDIT_FILE] ==================== SUCCESS ====================');
      return {
        success: true,
        data: {
          path: filePath,
          originalContent: returnOriginal,
          newContent: returnNew,
          truncated,
          oldStringLength: oldString.length,
          newStringLength: newString.length,
          changeInSize: newString.length - oldString.length,
        },
      };
    } catch (error) {
      console.error('[EDIT_FILE] ==================== EXCEPTION ====================');
      console.error('[EDIT_FILE] Exception:', error);
      return {
        success: false,
        error: `EDIT_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}. Call read_file to verify file content and try again.`,
      };
    }
  }

  private countOccurrences(content: string, searchString: string): { count: number; locations: number[] } {
    const locations: number[] = [];
    let index = 0;
    
    while ((index = content.indexOf(searchString, index)) !== -1) {
      locations.push(index);
      index += searchString.length;
    }
    
    return { count: locations.length, locations };
  }

  private getLineNumber(content: string, position: number): number {
    return content.substring(0, position).split('\n').length;
  }

  private getSnippet(content: string, position: number, maxLength: number): string {
    const start = Math.max(0, position - maxLength / 2);
    const end = Math.min(content.length, position + maxLength / 2);
    return content.substring(start, end).replace(/\n/g, '\\n');
  }

  private findSimilarContent(content: string, searchString: string): string[] {
    // Try to find similar strings (ignoring leading/trailing whitespace per line)
    const searchLines = searchString.split('\n');
    const contentLines = content.split('\n');
    const similar: string[] = [];
    
    if (searchLines.length === 1) {
      // Single line search - find lines with similar content
      const trimmedSearch = searchString.trim();
      for (let i = 0; i < contentLines.length; i++) {
        if (contentLines[i].trim() === trimmedSearch) {
          similar.push(`Line ${i + 1}: "${contentLines[i]}"`);
          if (similar.length >= 5) {
            break;
          }
        }
      }
    }
    
    return similar;
  }
}
