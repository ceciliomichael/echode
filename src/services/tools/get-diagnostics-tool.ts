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

          // If not a directory, open the file to ensure diagnostics are collected
          if (!isDirectoryTarget) {
            try {
              const uri = vscode.Uri.file(targetPath);
              
              // Start listening for diagnostic changes BEFORE opening the document
              // This ensures we don't miss updates that happen immediately upon opening
              const diagnosticsPromise = this.waitForDiagnosticsUpdate(uri, 4000);

              // Open the document to trigger diagnostic collection from language servers
              const doc = await vscode.workspace.openTextDocument(uri);
              
              // Explicitly show the document to force LSPs that require visibility to compute diagnostics
              // We check if it's already visible to avoid unnecessary UI updates
              if (!vscode.window.visibleTextEditors.some(e => e.document.uri.toString() === uri.toString())) {
                await vscode.window.showTextDocument(doc, { 
                  preserveFocus: true, 
                  preview: true 
                });
              }
              console.log(`[GetDiagnostics] Opened and showed document ${targetPath} to collect diagnostics`);

              // Wait for diagnostics to update or timeout
              await diagnosticsPromise;

              // Double-check: If file was very recently modified (e.g. just written), 
              // ensuring we waited long enough is handled by the promise above.
              // We don't need a second wait loop usually, as the first one catches the LSP reaction.
            } catch (e) {
              // Ignore fs errors (file might not exist yet)
              console.log(`[GetDiagnostics] Could not open document ${targetPath}:`, e);
            }
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
        // Single file case: fetch directly for this file
        const uri = vscode.Uri.file(targetPath);
        const diagnostics = vscode.languages.getDiagnostics(uri);
        processDiagnostics(uri, diagnostics);
      } else {
        // Directory or workspace scan case: fetch all and filter
        const allDiagnostics = vscode.languages.getDiagnostics();
        
        for (const [uri, diagnostics] of allDiagnostics) {
          const filePath = uri.fsPath;

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

  /**
   * Waits for diagnostics to update for a specific file URI.
   * Resolves when onDidChangeDiagnostics fires for that URI, or after timeout.
   */
  private async waitForDiagnosticsUpdate(uri: vscode.Uri, timeoutMs = 2000): Promise<void> {
    return new Promise<void>((resolve) => {
      let resolved = false;

      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        // Use case-insensitive comparison to handle Windows paths correctly
        if (e.uris.some(u => u.fsPath.toLowerCase() === uri.fsPath.toLowerCase())) {
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
