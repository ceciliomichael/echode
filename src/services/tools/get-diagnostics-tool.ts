import * as vscode from 'vscode';
import * as path from 'path';
import type { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { FileLockManager } from './utils/file-lock-manager';
import { getFileDiagnosticsAfterEdit, getStaleFileUris } from './utils/diagnostics-utils';
import { DEFAULT_IGNORED_PATTERNS, parseGitignore, matchesGitignorePattern } from '../../constants/excluded-patterns';

export class GetDiagnosticsTool implements ITool {
  name = 'get_diagnostics';

  /**
   * Check if a file path should be excluded from diagnostics
   */
  private isExcludedPath(filePath: string, workspaceRoot: string, gitignorePatterns: string[]): boolean {
    // Get path relative to workspace for pattern matching
    const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
    
    // Check against default ignored patterns (node_modules, dist, etc.)
    for (const pattern of DEFAULT_IGNORED_PATTERNS) {
      // Check if any path segment matches the pattern
      const segments = relativePath.split('/');
      for (const segment of segments) {
        if (segment === pattern) {
          return true;
        }
        // Handle glob patterns like *.log
        if (pattern.includes('*')) {
          const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
          if (new RegExp(`^${regexPattern}$`).test(segment)) {
            return true;
          }
        }
      }
    }
    
    // Check against gitignore patterns
    if (gitignorePatterns.length > 0 && matchesGitignorePattern(relativePath, gitignorePatterns)) {
      return true;
    }
    
    return false;
  }

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      // Get stale file URIs (files that no longer exist but still have diagnostics)
      const staleUris = await getStaleFileUris();
      
      // Get workspace root and gitignore patterns for filtering
      const workspaceRoot = getWorkspaceRoot();
      const gitignorePatterns = workspaceRoot ? parseGitignore(workspaceRoot) : [];

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
        }
      }

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

      // Helper to process diagnostics for a URI
      const processDiagnostics = (uri: vscode.Uri, diagnostics: vscode.Diagnostic[]) => {
        if (diagnostics.length === 0) { return; }

        const filtered = diagnostics.filter((d) =>
          d.severity === vscode.DiagnosticSeverity.Error ||
          d.severity === vscode.DiagnosticSeverity.Warning,
        );

        if (filtered.length === 0) { return; }

        const converted = filtered.map((d) => ({
          line: d.range.start.line + 1,
          character: d.range.start.character,
          severity: this.severityToString(d.severity),
          message: d.message,
          source: d.source,
          code: typeof d.code === 'object' ? d.code.value : d.code,
        }));

        results.push({
          filePath: uri.fsPath,
          diagnostics: converted,
        });
      };

      const openFileUris = vscode.workspace.textDocuments
        .map((d) => d.uri)
        .filter((uri) => uri.scheme === 'file');

      const eligibleUris: vscode.Uri[] = [];

      for (const uri of openFileUris) {
        // Skip stale diagnostics from deleted files
        if (staleUris.has(uri.toString())) {
          console.log(`[GetDiagnostics] Skipping stale diagnostics for deleted file: ${uri.fsPath}`);
          continue;
        }

        const filePath = uri.fsPath;

        // Skip excluded paths (node_modules, dist, .git, etc.)
        if (workspaceRoot && this.isExcludedPath(filePath, workspaceRoot, gitignorePatterns)) {
          continue;
        }

        if (targetPath) {
          const normalizedFilePath = path.normalize(filePath);
          const normalizedTarget = path.normalize(targetPath);

          if (!isDirectoryTarget) {
            if (normalizedFilePath !== normalizedTarget) {
              continue;
            }

            eligibleUris.push(uri);
            continue;
          }

          if (
            normalizedFilePath !== normalizedTarget &&
            !normalizedFilePath.startsWith(normalizedTarget + path.sep)
          ) {
            continue;
          }
        } else if (filePattern && !filePath.includes(filePattern)) {
          continue;
        }

        eligibleUris.push(uri);
      }

      const concurrency = 5;
      const queue = eligibleUris.slice();

      const worker = async () => {
        while (queue.length > 0) {
          const uri = queue.shift();
          if (!uri) {
            return;
          }

          const diagnostics = await getFileDiagnosticsAfterEdit(uri, 2500);
          if (diagnostics.length > 0) {
            results.push({
              filePath: uri.fsPath,
              diagnostics: diagnostics,
            });
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker())
      );

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
