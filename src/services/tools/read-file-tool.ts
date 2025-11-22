import * as vscode from 'vscode';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { DiagnosticsService, type CapturedDiagnostic } from '../diagnostics-service';

export class ReadFileTool implements ITool {
  name = 'read_file';

  private formatWithLineNumbers(lines: string[], startLine: number): string {
    return lines
      .map((line, index) => `${startLine + index}: ${line}`)
      .join('\n');
  }

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const offset = parameters.offset as number | undefined;
    const limit = parameters.limit as number | undefined;

    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);

      // Check if path is a directory
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          return {
            success: false,
            error: `Cannot read directory '${filePath}'. Please use 'list_files' to view directory contents, then call 'read_file' on a specific file from that listing (e.g., ${filePath}/file.tsx).`,
          };
        }
      } catch (error) {
        // If stat fails (e.g. file not found), readFile will handle the error appropriate
      }

      const fileContent = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(fileContent).toString('utf8');
      const lines = content.split('\n');
      const totalLines = lines.length;

      // Apply default 100-line limit when no range specified
      if (offset === undefined && limit === undefined) {
        const defaultStart = 0;
        const defaultCount = Math.min(100, lines.length);
        const defaultEnd = Math.min(defaultStart + defaultCount, lines.length);
        const selectedLines = lines.slice(defaultStart, defaultEnd);
        const formattedContent = this.formatWithLineNumbers(selectedLines, defaultStart + 1);

        // Capture diagnostics for the file
        const diagnosticsService = DiagnosticsService.getInstance();
        let diagnostics: CapturedDiagnostic[] = [];
        if (diagnosticsService.isEnabled()) {
          try {
            diagnostics = await diagnosticsService.captureDiagnosticsForFile(absolutePath, {
              delay: diagnosticsService.getConfig('delay', 800),
              timeout: diagnosticsService.getConfig('timeout', 5000),
            });
            console.log(`[READ_FILE] Captured ${diagnostics.length} diagnostics`);
          } catch (diagError) {
            console.warn('[READ_FILE] Failed to capture diagnostics:', diagError);
          }
        }

        return {
          success: true,
          data: {
            path: filePath,
            content: formattedContent,
            startLine: defaultStart + 1,
            endLine: defaultEnd,
            totalLines,
            diagnostics,
          },
        };
      }

      // Apply explicit offset/limit if specified
      const start = offset ? Math.max(0, offset - 1) : 0;
      const count = limit || lines.length;
      const end = Math.min(start + count, lines.length);
      const selectedLines = lines.slice(start, end);
      const formattedContent = this.formatWithLineNumbers(selectedLines, start + 1);

      // Capture diagnostics for the file
      const diagnosticsService = DiagnosticsService.getInstance();
      let diagnostics: CapturedDiagnostic[] = [];
      if (diagnosticsService.isEnabled()) {
        try {
          diagnostics = await diagnosticsService.captureDiagnosticsForFile(absolutePath, {
            delay: diagnosticsService.getConfig('delay', 800),
            timeout: diagnosticsService.getConfig('timeout', 5000),
          });
          console.log(`[READ_FILE] Captured ${diagnostics.length} diagnostics`);
        } catch (diagError) {
          console.warn('[READ_FILE] Failed to capture diagnostics:', diagError);
        }
      }

      return {
        success: true,
        data: {
          path: filePath,
          content: formattedContent,
          startLine: start + 1,
          endLine: end,
          totalLines,
          diagnostics,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

}
