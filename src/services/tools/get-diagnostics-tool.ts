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

          // If not a directory, open the file to ensure diagnostics are collected
          if (!isDirectoryTarget) {
            // Logic handled by getFileDiagnosticsAfterEdit called below
          } else {
            // If it's a directory, find all files and open them to collect diagnostics
            try {
              const files = await this.findFilesInDirectory(targetPath);
              console.log(`[GetDiagnostics] Found ${files.length} files in directory ${targetPath}`);
              
              // Open files in batches to avoid overwhelming the language server
              const batchSize = 10;
              for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                const promises = batch.map(async (filePath) => {
                  try {
                    const uri = vscode.Uri.file(filePath);
                    await vscode.workspace.openTextDocument(uri);
                  } catch (e) {
                    // Ignore individual file errors
                  }
                });
                await Promise.all(promises);
              }
              
              // Wait for all diagnostics to settle
              console.log(`[GetDiagnostics] Waiting for diagnostics to update for all files...`);
              await new Promise(resolve => setTimeout(resolve, 4000));
            } catch (e) {
              console.log(`[GetDiagnostics] Error scanning directory ${targetPath}:`, e);
            }
          }
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

      if (targetPath && !isDirectoryTarget) {
        // Single file case: fetch directly for this file using the robust utility
        const uri = vscode.Uri.file(targetPath);
        // Note: We use the default timeout (5s) as this is an explicit user request for diagnostics
        const diagnostics = await getFileDiagnosticsAfterEdit(uri);
        
        if (diagnostics.length > 0) {
          results.push({
            filePath: targetPath,
            diagnostics: diagnostics,
          });
        }
      } else {
        // Directory or workspace scan case: fetch all and filter
        const allDiagnostics = vscode.languages.getDiagnostics();
        
        for (const [uri, diagnostics] of allDiagnostics) {
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
            // Directory target
            const normalizedFilePath = path.normalize(filePath);
            const normalizedTarget = path.normalize(targetPath);

            if (
              normalizedFilePath !== normalizedTarget &&
              !normalizedFilePath.startsWith(normalizedTarget + path.sep)
            ) {
              continue;
            }
          } else if (filePattern && !filePath.includes(filePattern)) {
            continue;
          }

          processDiagnostics(uri, diagnostics);
        }
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
   * Recursively find all files in a directory
   */
  private async findFilesInDirectory(dirPath: string): Promise<string[]> {
    const fs = require('fs').promises;
    const results: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = await this.findFilesInDirectory(fullPath);
          results.push(...subFiles);
        } else if (entry.isFile()) {
          // Only include common source code files
          const ext = path.extname(entry.name).toLowerCase();
          const includedExtensions = [
            '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
            '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.r',
            '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
            '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf',
            '.md', '.txt', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd'
          ];
          
          if (includedExtensions.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.log(`[GetDiagnostics] Error reading directory ${dirPath}:`, error);
    }

    return results;
  }

}
