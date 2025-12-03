import * as vscode from 'vscode';
import * as path from 'path';
import type { ITool, ToolExecutionResult } from './tool.interface';
import { unescapeHtmlEntities } from '../../utils/text-normalization';
import { detectCodeOmission } from '../../utils/detect-code-omission';
import { getWorkspaceRoot, resolveAbsolutePath, getCreatedDirectories } from './utils/workspace-utils';

export class WriteFileTool implements ITool {
  name = 'write_to_file';

  private readonly BINARY_EXTENSIONS = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'ico', 'bmp', 'webp', 'svg',
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

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
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
    // IMPORTANT: Do NOT apply this to markdown-like files, where trailing ``` is
    // usually a legitimate fenced code block (e.g., mermaid diagrams at EOF).
    if (!isMarkdownLike && content.startsWith('```')) {
      content = content.split('\n').slice(1).join('\n');
    }

    if (!isMarkdownLike && content.endsWith('```')) {
      content = content.split('\n').slice(0, -1).join('\n');
    }

    // Unescape HTML entities (smart quotes, etc.) for non-Claude models
    // Claude models tend to handle this better natively
    content = unescapeHtmlEntities(content);

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

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);
      
      // Check if file exists and capture old content
      let oldContent: string | null = null;
      let fileExisted = false;
      try {
        const oldFileContent = await vscode.workspace.fs.readFile(uri);
        oldContent = Buffer.from(oldFileContent).toString('utf8');
        fileExisted = true;
      } catch {
        // File doesn't exist, this is a new file
        fileExisted = false;
      }

      // Skip line_count validation - rely on diagnostics feedback instead
      console.log('[WRITE_FILE] Skipping line_count validation, diagnostics will catch errors');
      
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
      const contentBytes = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      console.log('[WRITE_FILE] File written successfully');

      // Post-write verification: try reading back as text
      try {
        const verifyContent = await vscode.workspace.fs.readFile(uri);
        const verifyString = Buffer.from(verifyContent).toString('utf8');
        const verifyCheck = this.detectBinaryContent(verifyString);
        
        if (verifyCheck.isBinary) {
          console.log('[WRITE_FILE] WARNING: Written file looks binary on read-back:', verifyCheck.reason);
          // Could optionally revert here, but for now just warn
        } else {
          console.log('[WRITE_FILE] Post-write verification passed');
        }
      } catch (verifyError) {
        console.log('[WRITE_FILE] WARNING: Could not verify written file:', verifyError);
      }

      console.log('[WRITE_FILE] ==================== SUCCESS ====================');
      return {
        success: true,
        data: {
          path: filePath,
          absolutePath,
          action: fileExisted ? 'modified' : 'created',
          oldContent: oldContent,
          newContent: content,
          createdDirectories: fileExisted ? [] : createdDirectories,
        },
      };
    } catch (error) {
      console.error('[WRITE_FILE] ==================== EXCEPTION ====================');
      console.error('[WRITE_FILE] Exception:', error);
      return {
        success: false,
        error: `WRITE_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
