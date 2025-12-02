import * as vscode from 'vscode';
import type { ITool, ToolExecutionResult } from './tool.interface';

export class GetDiagnosticsTool implements ITool {
  name = 'get_diagnostics';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const includeWarnings = parameters.include_warnings !== false;
      const filePattern = typeof parameters.file_pattern === 'string' && parameters.file_pattern.trim().length > 0
        ? parameters.file_pattern.trim()
        : undefined;

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

        if (filePattern && !filePath.includes(filePattern)) {
          continue;
        }

        const filtered = diagnostics.filter((d) => {
          if (d.severity === vscode.DiagnosticSeverity.Error) {
            return true;
          }
          if (!includeWarnings) {
            return false;
          }
          return (
            d.severity === vscode.DiagnosticSeverity.Warning ||
            d.severity === vscode.DiagnosticSeverity.Information ||
            d.severity === vscode.DiagnosticSeverity.Hint
          );
        });

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
}
