import * as vscode from 'vscode';
import * as path from 'path';
import type { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { FileLockManager } from './utils/file-lock-manager';

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

        // Wait for any active file modifications to finish
        if (targetPath) {
          await FileLockManager.waitForLock(targetPath);

          // If not a directory, check if we need to wait for fresh diagnostics
          if (!isDirectoryTarget) {
            try {
              const fs = require('fs');
              const stats = fs.statSync(targetPath);
              const modifiedAgeMs = Date.now() - stats.mtimeMs;

              // If modified less than 2 seconds ago, wait for diagnostics update
              // This handles the lag between file save and LSP publishing diagnostics
              if (modifiedAgeMs < 2000) {
                console.log(`[GetDiagnostics] File ${targetPath} modified recently (${modifiedAgeMs}ms ago). Waiting for fresh diagnostics...`);
                await this.waitForDiagnosticsUpdate(vscode.Uri.file(targetPath));
              }
            } catch (e) {
              // Ignore fs errors (file might not exist yet)
            }
          }
        }
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
        if (diagnostics.length === 0) { continue; }

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

        if (filtered.length === 0) { continue; }

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

  /**
   * Waits for diagnostics to update for a specific file URI.
   * Resolves when onDidChangeDiagnostics fires for that URI, or after timeout.
   */
  private async waitForDiagnosticsUpdate(uri: vscode.Uri, timeoutMs = 2000): Promise<void> {
    return new Promise<void>((resolve) => {
      let resolved = false;

      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        if (e.uris.some(u => u.fsPath === uri.fsPath)) {
          if (!resolved) {
            resolved = true;
            disposable.dispose();
            // Give a tiny buffer for full diagnostic set to populate
            setTimeout(resolve, 50);
          }
        }
      });

      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          disposable.dispose();
          console.log(`[GetDiagnostics] Timeout waiting for diagnostics update for ${uri.fsPath}`);
          resolve();
        }
      }, timeoutMs);
    });
  }
}
