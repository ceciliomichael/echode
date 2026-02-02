import * as vscode from 'vscode';
import * as path from 'path';
import type { ITool, ToolExecutionResult, ChatMode, ToolConfirmation } from './tool.interface';
import { unescapeHtmlEntities, stripAllCDataWrappers } from '../../utils/text-normalization';
import { detectCodeOmission } from '../../utils/detect-code-omission';
import { getWorkspaceRoot, resolveAbsolutePath, getCreatedDirectories } from './utils/workspace-utils';
import { FileLockManager } from './utils/file-lock-manager';
import { writeFileWithRetry } from './utils/write-file-with-retry';

export class WriteFileTool implements ITool {
  name = 'write_to_file';

  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path to write to',
      },
      content: {
        type: 'string',
        description: 'The full content to write to the file',
      },
      line_count: {
        type: 'number',
        description: 'Expected line count (optional, for validation)',
      },
    },
    required: ['path', 'content'],
  };

  private readonly BINARY_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'ico', 'bmp', 'webp',
    'zip', 'tar', 'gz', 'rar', '7z',
    'exe', 'dll', 'so', 'dylib',
    'pdf', 'doc', 'docx', 'xls', 'xlsx',
    'mp3', 'mp4', 'avi', 'mov', 'wav',
    'ttf', 'otf', 'woff', 'woff2',
  ]);

  private readonly MARKDOWN_LIKE_EXTENSIONS = new Set([
    'md',
    'markdown',
    'mdx',
    'adoc',
    'rst',
  ]);

  private readonly MAX_CONTENT_SIZE = 1024 * 1024 * 5; // 5MB limit

  private isBinaryExtension(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext ? this.BINARY_EXTENSIONS.has(ext) : false;
  }

  private detectBinaryContent(content: string): { isBinary: boolean; reason?: string } {
    // Check for null bytes
    if (content.includes('\u0000')) {
      return { isBinary: true, reason: 'Contains null bytes (\\u0000)' };
    }

    // Count control characters (excluding common whitespace)
    let controlCharCount = 0;
    for (let i = 0; i < Math.min(content.length, 8192); i++) {
      const code = content.charCodeAt(i);
      // Control chars except: tab(9), LF(10), CR(13)
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
        controlCharCount++;
      }
    }

    const controlRatio = controlCharCount / Math.min(content.length, 8192);
    if (controlRatio > 0.3) {
      return { isBinary: true, reason: `High control character ratio: ${(controlRatio * 100).toFixed(1)}%` };
    }

    return { isBinary: false };
  }

  /**
   * Prepare execution for Manual Mode approval.
   * Returns confirmation data with old/new content diff.
   */
  async prepareExecution(
    parameters: Record<string, unknown>
  ): Promise<ToolConfirmation | undefined> {
    const filePath = parameters.path as string;
    const rawContent = parameters.content;

    if (!filePath || typeof rawContent !== 'string') {
      return undefined;
    }

    let content = rawContent;

    // Apply same content normalization as execute()
    const ext = filePath.split('.').pop()?.toLowerCase();
    const isMarkdownLike = ext ? this.MARKDOWN_LIKE_EXTENSIONS.has(ext) : false;

    if (!isMarkdownLike) {
      const startsWithFence = /^```[a-zA-Z]*\r?\n/.test(content);
      const endsWithFence = /\r?\n```$/.test(content);
      if (startsWithFence && endsWithFence) {
        content = content.split('\n').slice(1, -1).join('\n');
      }
    }

    content = unescapeHtmlEntities(content);
    content = stripAllCDataWrappers(content);

    const hasActualNewlines = content.includes('\n');
    const hasEscapedSequences = /\\[ntr]/.test(content);
    if (!hasActualNewlines && hasEscapedSequences) {
      content = content
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r');
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return undefined;
    }

    const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
    const uri = vscode.Uri.file(absolutePath);
    let fileExistsOnDisk = false;

    try {
      await vscode.workspace.fs.stat(uri);
      fileExistsOnDisk = true;
    } catch {
      fileExistsOnDisk = false;
    }

    let oldContent: string | null = null;
    if (fileExistsOnDisk) {
      try {
        const document = await vscode.workspace.openTextDocument(uri);
        oldContent = document.getText();
      } catch {
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          oldContent = Buffer.from(bytes).toString('utf8');
        } catch {
          oldContent = null;
        }
      }
    }

    const action = fileExistsOnDisk ? 'Modify' : 'Create';

    return {
      toolName: this.name,
      title: `${action} File: ${filePath}`,
      message: fileExistsOnDisk
        ? `This will modify the existing file "${filePath}".`
        : `This will create a new file "${filePath}".`,
      diff: {
        oldContent,
        newContent: content,
        fileName: filePath,
      },
      parameters,
    };
  }

  async execute(
    parameters: Record<string, unknown>,
    _onProgress?: unknown,
    _signal?: AbortSignal,
    mode?: ChatMode
  ): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const lineCountParam = parameters.line_count as number | undefined;
    const rawContent = parameters.content;

    console.log('[WRITE_FILE] ==================== START ====================');
    console.log('[WRITE_FILE] Target file:', filePath);

    if (!filePath) {
      console.log('[WRITE_FILE] ERROR: No file path provided');
      return { success: false, error: 'File path is required' };
    }

    if (rawContent === undefined) {
      console.log('[WRITE_FILE] ERROR: No content provided');
      return { success: false, error: 'Content is required' };
    }

    // Type guard: content must be a string
    if (typeof rawContent !== 'string') {
      console.log('[WRITE_FILE] ERROR: Content is not a string, got type:', typeof rawContent);
      return {
        success: false,
        error: `CONTENT_TYPE_INVALID: write_to_file requires content as plain text string, got ${typeof rawContent}. Serialize or format as text first.`,
      };
    }

    let content = rawContent as string;

    const ext = filePath.split('.').pop()?.toLowerCase();
    const isMarkdownLike = ext ? this.MARKDOWN_LIKE_EXTENSIONS.has(ext) : false;

    // Strip surrounding code fences if present (```), similar to Roo Code behavior.
    // IMPORTANT: Only strip if content looks like it was wrapped in markdown code block
    // (starts with ```language\n and ends with \n```). Don't strip if user intentionally
    // wants to write ``` as content.
    if (!isMarkdownLike) {
      // Only strip if it looks like a markdown code block wrapper:
      // - Starts with ``` followed by optional language then newline
      // - Ends with newline then ```
      const startsWithFence = /^```[a-zA-Z]*\r?\n/.test(content);
      const endsWithFence = /\r?\n```$/.test(content);

      if (startsWithFence && endsWithFence) {
        // Strip both fences together (it's a wrapper)
        content = content.split('\n').slice(1, -1).join('\n');
      }
    }

    // Unescape HTML entities (smart quotes, etc.) for non-Claude models
    // Claude models tend to handle this better natively
    content = unescapeHtmlEntities(content);

    // Strip CDATA wrappers that some models (like Gemini) may add
    content = stripAllCDataWrappers(content);

    // Convert escaped \n, \t, \r sequences ONLY when the content appears to be
    // a single packed line with no real newlines. This prevents us from
    // touching intentional "\\n" inside string literals in normal multi-line code.
    const hasActualNewlines = content.includes('\n');
    const hasEscapedSequences = /\\[ntr]/.test(content);
    if (!hasActualNewlines && hasEscapedSequences) {
      console.log('[WRITE_FILE] Converting escaped sequences (\\n, \\t, \\r) to actual characters for single-line packed content');
      content = content
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r');
    }

    console.log('[WRITE_FILE] Content length:', content.length, 'characters');

    // Size check
    if (content.length > this.MAX_CONTENT_SIZE) {
      console.log('[WRITE_FILE] ERROR: Content too large:', content.length, 'bytes');
      return {
        success: false,
        error: `CONTENT_TOO_LARGE: Content size ${(content.length / 1024 / 1024).toFixed(2)}MB exceeds ${this.MAX_CONTENT_SIZE / 1024 / 1024}MB limit. Consider breaking into smaller files or using a different approach.`,
      };
    }

    // Binary extension check
    if (this.isBinaryExtension(filePath)) {
      console.log('[WRITE_FILE] ERROR: Binary extension detected');
      return {
        success: false,
        error: `BINARY_FILE_BLOCKED: write_to_file is for text files only. Refusing to write to binary-like file: ${filePath}. Use appropriate binary file handling instead.`,
      };
    }

    // Binary content detection
    const binaryCheck = this.detectBinaryContent(content);
    if (binaryCheck.isBinary) {
      console.log('[WRITE_FILE] ERROR: Binary content detected:', binaryCheck.reason);
      return {
        success: false,
        error: `BINARY_CONTENT_DETECTED: Content appears to be binary or non-text (${binaryCheck.reason}). write_to_file is for readable source/text files only.`,
      };
    }


    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      return { success: false, error: 'No workspace folder open' };
    }

    const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);

    // Acquire lock
    let acquired = FileLockManager.tryAcquire(absolutePath);
    if (!acquired) {
      await FileLockManager.waitForLock(absolutePath);
      acquired = FileLockManager.tryAcquire(absolutePath);
    }

    if (!acquired) {
      return { success: false, error: `File is currently being modified: ${filePath}` };
    }

    try {
      const uri = vscode.Uri.file(absolutePath);

      // Check if file exists and capture old content
      let oldContent: string | null = null;
      let fileExistsOnDisk = false;
      let existingDocument: vscode.TextDocument | null = null;

      try {
        await vscode.workspace.fs.stat(uri);
        fileExistsOnDisk = true;
      } catch {
        fileExistsOnDisk = false;
      }

      // Try to open the document (may succeed even if file doesn't exist on disk)
      try {
        existingDocument = await vscode.workspace.openTextDocument(uri);
      } catch {
        existingDocument = null;
      }

      if (fileExistsOnDisk) {
        if (existingDocument) {
          oldContent = existingDocument.getText();
        } else {
          try {
            const oldFileContent = await vscode.workspace.fs.readFile(uri);
            oldContent = Buffer.from(oldFileContent).toString('utf8');
          } catch {
            oldContent = null;
          }
        }
      } else {
        // Treat missing-on-disk as a new file even if a cached editor exists
        oldContent = null;
      }

      if (fileExistsOnDisk && oldContent !== null) {
        // Check for identical content (no-op)
        if (oldContent === content) {
          console.log('[WRITE_FILE] Content matches existing file, skipping write');
          console.log('[WRITE_FILE] ==================== SUCCESS (NO-OP) ====================');
          return {
            success: true,
            data: {
              path: filePath,
              absolutePath,
              action: 'no_change',
              oldContent: oldContent,
              newContent: content,
              createdDirectories: [],
              summary: `No changes made to ${filePath} (content identical to existing file)`,
            },
          };
        }
      }

      // Track which directories will be created
      const createdDirectories = await getCreatedDirectories(filePath, workspaceRoot);

      // Create parent directories if needed
      const dirPath = path.dirname(absolutePath);
      const dirUri = vscode.Uri.file(dirPath);
      try {
        await vscode.workspace.fs.createDirectory(dirUri);
      } catch {
        // Directory might already exist
      }

      // Write new content
      const writeResult = await writeFileWithRetry(uri, content, 3, 75);
      if (!writeResult.success) {
        return {
          success: false,
          error: writeResult.error ?? 'Failed to write file with integrity verification',
        };
      }

      console.log('[WRITE_FILE] File written successfully');

      // Open the file in the editor
      try {
        await vscode.commands.executeCommand('vscode.open', uri, {
          preview: false,
          background: true,
        });
        console.log(`[WRITE_FILE] Opened file in editor: ${filePath}`);
      } catch (error) {
        console.warn(`[WRITE_FILE] Could not open file in editor: ${filePath}`, error);
        // Don't fail the write if we can't open the file
      }

      // Post-write verification: try reading back as text
      try {
        const verifyContent = await vscode.workspace.fs.readFile(uri);
        const verifyString = Buffer.from(verifyContent).toString('utf8');
        const verifyCheck = this.detectBinaryContent(verifyString);

        if (verifyCheck.isBinary) {
          console.log('[WRITE_FILE] WARNING: Written file looks binary on read-back:', verifyCheck.reason);
        } else {
          console.log('[WRITE_FILE] Post-write verification passed');
        }
      } catch (verifyError) {
        console.log('[WRITE_FILE] WARNING: Could not verify written file:', verifyError);
      }

      console.log('[WRITE_FILE] ==================== SUCCESS ====================');

      // Calculate line count and add mode-specific reminder for large files
      const lineCount = content.split(/\r?\n/).length;
      let largeFileReminder: string | undefined;
      if (lineCount > 300 && (mode === 'agent' || mode === 'general' || mode === undefined)) {
        const action = fileExistsOnDisk ? 'MODIFIED' : 'CREATED';
        largeFileReminder = `[${action} LARGE FILE - ${lineCount} LINES] This file exceeds the 300-line threshold. Consider refactoring into smaller, focused modules to maintain code quality.`;
      }

      const refactorNotice = largeFileReminder
        ? {
          type: 'large_file',
          lineCount,
          mode,
          message: largeFileReminder,
        }
        : undefined;

      return {
        success: true,
        data: {
          message: `Successfully ${fileExistsOnDisk ? 'modified' : 'created'} ${filePath}`,
          path: filePath,
          absolutePath,
          action: fileExistsOnDisk ? 'modified' : 'created',
          oldContent: oldContent,
          newContent: content,
          createdDirectories: fileExistsOnDisk ? [] : createdDirectories,
          lineCount,
          largeFileReminder,
          refactorNotice,
        },
      };
    } catch (error) {
      console.error('[WRITE_FILE] ==================== EXCEPTION ====================');
      console.error('[WRITE_FILE] Exception:', error);
      return {
        success: false,
        error: `WRITE_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    } finally {
      // Always release lock
      FileLockManager.release(absolutePath);
    }
  }
}
