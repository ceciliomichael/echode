import * as vscode from 'vscode';
import * as path from 'path';
import type { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';

export class GetDiagnosticsTool implements ITool {
  name = 'get_diagnostics';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const rawPath = typeof parameters.path === 'string' && parameters.path.trim().length > 0
        ? parameters.path.trim()
        : undefined;
      const filePattern = typeof parameters.file_pattern === 'string' && parameters.file_pattern.trim().length > 0
        ? parameters.file_pattern.trim()
        : undefined;

      let targetPath: string | undefined;
      let isDirectoryTarget = false;

      if (rawPath) {
        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot) {
          return {
            success: false,
            error: 'No workspace folder open',
          };
        }

        const resolved = resolveAbsolutePath(rawPath, workspaceRoot);
        targetPath = resolved;
        isDirectoryTarget = this.isDirectoryTarget(resolved);
      }

      const allDiagnostics = vscode.languages.getDiagnostics();

      const results: Array<{
        filePath: string;
        diagnostics: Array<{
          line: number;
          character: number;
          severity: 'Error' | 'Warning' | 'Information' | 'Hint';
          message: string;
          source?: string;
          code?: string | number;
        }>;
      }> = [];

      for (const [uri, diagnostics] of allDiagnostics) {
        if (diagnostics.length === 0) {continue;}

        const filePath = uri.fsPath;

        if (targetPath) {
          const normalizedFilePath = path.normalize(filePath);
          const normalizedTarget = path.normalize(targetPath);

          if (isDirectoryTarget) {
            if (
              normalizedFilePath !== normalizedTarget &&
              !normalizedFilePath.startsWith(normalizedTarget + path.sep)
            ) {
              continue;
            }
          } else {
            if (normalizedFilePath !== normalizedTarget) {
              continue;
            }
          }
        } else if (filePattern && !filePath.includes(filePattern)) {
          continue;
        }

        const filtered = diagnostics.filter((d) =>
          d.severity === vscode.DiagnosticSeverity.Error ||
          d.severity === vscode.DiagnosticSeverity.Warning ||
          d.severity === vscode.DiagnosticSeverity.Information ||
          d.severity === vscode.DiagnosticSeverity.Hint,
        );

        if (filtered.length === 0) {continue;}

        const converted = filtered.map((d) => ({
          line: d.range.start.line + 1,
          character: d.range.start.character,
          severity: this.severityToString(d.severity),
          message: d.message,
          source: d.source,
          code: typeof d.code === 'object' ? d.code.value : d.code,
        }));

        results.push({
          filePath,
          diagnostics: converted,
        });
      }

      return {
        success: true,
        data: {
          files: results,
          totalFilesWithDiagnostics: results.length,
          totalDiagnostics: results.reduce((sum, f) => sum + f.diagnostics.length, 0),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to collect diagnostics',
      };
    }
  }

  private severityToString(
    severity: vscode.DiagnosticSeverity,
  ): 'Error' | 'Warning' | 'Information' | 'Hint' {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return 'Error';
      case vscode.DiagnosticSeverity.Warning:
        return 'Warning';
      case vscode.DiagnosticSeverity.Information:
        return 'Information';
      case vscode.DiagnosticSeverity.Hint:
        return 'Hint';
      default:
        return 'Information';
    }
  }

  private isDirectoryTarget(resolvedPath: string): boolean {
    // Heuristic: if the path has a file extension, treat it as a file; otherwise as a directory.
    const ext = path.extname(resolvedPath);
    return ext.length === 0;
  }
}
