import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { DiagnosticsService, type CapturedDiagnostic } from '../diagnostics-service';

interface Edit {
  id?: string;
  old_string: string;
  new_string: string;
}

interface EditResult {
  index: number;
  id?: string;
  oldStringLength: number;
  newStringLength: number;
  changeInSize: number;
}

export class MultiEditTool implements ITool {
  name = 'multi_edit';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const edits = parameters.edits as Edit[];

    console.log('[MULTI_EDIT] ==================== START ====================');
    console.log('[MULTI_EDIT] Target file:', filePath);
    console.log('[MULTI_EDIT] Number of edits:', edits?.length || 0);

    if (!filePath) {
      console.log('[MULTI_EDIT] ERROR: No file path provided');
      return { success: false, error: 'File path is required' };
    }

    if (!Array.isArray(edits) || edits.length === 0) {
      console.log('[MULTI_EDIT] ERROR: edits must be a non-empty array');
      return { success: false, error: 'Parameter "edits" must be a non-empty array of edit objects' };
    }

    // Validate each edit
    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      if (typeof edit.old_string !== 'string') {
        return { success: false, error: `Edit ${i}: old_string must be a string` };
      }
      if (typeof edit.new_string !== 'string') {
        return { success: false, error: `Edit ${i}: new_string must be a string` };
      }
      if (edit.old_string === edit.new_string) {
        return { success: false, error: `Edit ${i}: old_string and new_string are identical (no-op)` };
      }
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        console.log('[MULTI_EDIT] ERROR: No workspace folder open');
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);
      console.log('[MULTI_EDIT] Absolute path:', absolutePath);

      // Read current file content
      let originalContent: string;
      try {
        const fileContent = await vscode.workspace.fs.readFile(uri);
        originalContent = Buffer.from(fileContent).toString('utf8');
        console.log('[MULTI_EDIT] File read successfully, length:', originalContent.length, 'characters');
      } catch (error) {
        console.log('[MULTI_EDIT] ERROR: File not found:', error);
        return {
          success: false,
          error: `FILE_NOT_FOUND: Cannot read file '${filePath}'. Verify the path is correct.`,
        };
      }

      // Apply edits sequentially in memory
      let workingContent = originalContent;
      const editResults: EditResult[] = [];

      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const editLabel = edit.id ? `Edit ${i} (id='${edit.id}')` : `Edit ${i}`;
        
        console.log(`[MULTI_EDIT] ${editLabel}: Applying...`);
        console.log(`[MULTI_EDIT] ${editLabel}: old_string length:`, edit.old_string.length);
        console.log(`[MULTI_EDIT] ${editLabel}: new_string length:`, edit.new_string.length);
        console.log(`[MULTI_EDIT] ${editLabel}: old_string preview:`, edit.old_string.substring(0, 100).replace(/\n/g, '\\n'));

        // Count occurrences
        const occurrences = this.countOccurrences(workingContent, edit.old_string);
        console.log(`[MULTI_EDIT] ${editLabel}: Found ${occurrences.count} occurrence(s)`);

        if (occurrences.count === 0) {
          console.log(`[MULTI_EDIT] ${editLabel}: ERROR - old_string not found`);
          
          // Provide helpful context
          const similarLines = this.findSimilarContent(workingContent, edit.old_string);
          let errorMsg = `MULTI_EDIT_FAILED: ${editLabel}: STRING_NOT_FOUND\n\nThe exact string was not found in the current file content.\n\nYou must copy the EXACT text from read_file output, including all whitespace and line breaks.`;
          
          if (similarLines.length > 0) {
            errorMsg += `\n\nSimilar content found (check whitespace/indentation):\n${similarLines.slice(0, 3).join('\n')}`;
          }
          
          errorMsg += '\n\nTo fix: Call read_file again, copy exact string for this edit, and retry multi_edit. OR split into separate edit_file calls.';
          
          return { success: false, error: errorMsg };
        }

        if (occurrences.count > 1) {
          console.log(`[MULTI_EDIT] ${editLabel}: ERROR - old_string appears multiple times`);
          
          const locations = occurrences.locations.slice(0, 5).map(loc => {
            const lineNum = this.getLineNumber(workingContent, loc);
            const snippet = this.getSnippet(workingContent, loc, 40);
            return `  Line ${lineNum}: ...${snippet}...`;
          }).join('\n');
          
          return {
            success: false,
            error: `MULTI_EDIT_FAILED: ${editLabel}: STRING_AMBIGUOUS\n\nThe string appears ${occurrences.count} times in the file. You must provide more context to make it unique.\n\nLocations:\n${locations}\n\nTo fix: Include surrounding lines or more context in old_string to uniquely identify which occurrence to replace.`,
          };
        }

        // Perform replacement
        workingContent = workingContent.replace(edit.old_string, edit.new_string);
        console.log(`[MULTI_EDIT] ${editLabel}: Replacement successful`);
        
        editResults.push({
          index: i,
          id: edit.id,
          oldStringLength: edit.old_string.length,
          newStringLength: edit.new_string.length,
          changeInSize: edit.new_string.length - edit.old_string.length,
        });
      }

      console.log('[MULTI_EDIT] All edits applied successfully');
      console.log('[MULTI_EDIT] Original content length:', originalContent.length);
      console.log('[MULTI_EDIT] New content length:', workingContent.length);

      // Write to file
      const contentBytes = Buffer.from(workingContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      console.log('[MULTI_EDIT] File written successfully');

      // Capture diagnostics after file write
      const diagnosticsService = DiagnosticsService.getInstance();
      let diagnostics: CapturedDiagnostic[] = [];
      if (diagnosticsService.isEnabled()) {
        try {
          diagnostics = await diagnosticsService.captureDiagnosticsForFile(absolutePath, {
            delay: diagnosticsService.getConfig('delay', 800),
            timeout: diagnosticsService.getConfig('timeout', 5000),
          });
          console.log(`[MULTI_EDIT] Captured ${diagnostics.length} diagnostics`);
        } catch (diagError) {
          console.warn('[MULTI_EDIT] Failed to capture diagnostics:', diagError);
        }
      }

      // Truncate for return if too large
      const MAX_CONTENT_SIZE = 1024 * 512; // 512KB
      let returnOriginal = originalContent;
      let returnNew = workingContent;
      let truncated = false;

      if (originalContent.length > MAX_CONTENT_SIZE || workingContent.length > MAX_CONTENT_SIZE) {
        returnOriginal = originalContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        returnNew = workingContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        truncated = true;
      }

      console.log('[MULTI_EDIT] ==================== SUCCESS ====================');
      return {
        success: true,
        data: {
          path: filePath,
          originalContent: returnOriginal,
          newContent: returnNew,
          truncated,
          edits: editResults,
          diagnostics,
        },
      };
    } catch (error) {
      console.error('[MULTI_EDIT] ==================== EXCEPTION ====================');
      console.error('[MULTI_EDIT] Exception:', error);
      return {
        success: false,
        error: `MULTI_EDIT_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}. Call read_file to verify file content and try again.`,
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
