import * as vscode from 'vscode';

export interface CapturedDiagnostic {
  line: number;
  character: number;
  severity: 'Error' | 'Warning' | 'Information' | 'Hint';
  message: string;
  source?: string;
  code?: string | number;
}

export interface DiagnosticsOptions {
  /** Delay in ms to wait for language server analysis (default: 500) */
  delay?: number;
  /** Open document if closed to trigger language server (default: true) */
  ensureOpen?: boolean;
  /** Include only specific severities (default: Error and Warning) */
  severities?: vscode.DiagnosticSeverity[];
  /** Maximum time to wait for diagnostics (default: 1000ms) */
  timeout?: number;
}

/**
 * Service for capturing VS Code diagnostics (Problems panel) after file modifications
 * Language-agnostic: works with TypeScript, Dart, Python, Go, Rust, etc.
 */
export class DiagnosticsService {
  private static instance: DiagnosticsService | null = null;

  private constructor() {}

  public static getInstance(): DiagnosticsService {
    if (!DiagnosticsService.instance) {
      DiagnosticsService.instance = new DiagnosticsService();
    }
    return DiagnosticsService.instance;
  }

  /**
   * Capture diagnostics for a file after it has been modified
   * Opens file in background to trigger language server if needed
   */
  async captureDiagnosticsForFile(
    filePath: string,
    options: DiagnosticsOptions = {}
  ): Promise<CapturedDiagnostic[]> {
    const {
      delay = 500,
      ensureOpen = true,
      severities = [
        vscode.DiagnosticSeverity.Error,
        vscode.DiagnosticSeverity.Warning,
      ],
      timeout = 1000,
    } = options;

    try {
      const uri = vscode.Uri.file(filePath);

      // Check if already open in any editor
      const wasOpen = vscode.window.visibleTextEditors.some(
        (editor) => editor.document.uri.toString() === uri.toString()
      );

      console.log(`[Diagnostics] Capturing for: ${filePath}`);
      console.log(`[Diagnostics] File was open: ${wasOpen}`);

      // Open file in editor window to trigger language server analysis
      if (!wasOpen && ensureOpen) {
        try {
          const document = await vscode.workspace.openTextDocument(uri);
          // Show in editor to ensure language server analyzes it
          await vscode.window.showTextDocument(document, {
            preview: false, // Open as permanent tab, not preview
            preserveFocus: true, // Don't steal focus from user
          });
          console.log('[Diagnostics] File opened in editor for analysis');
        } catch (error) {
          console.warn('[Diagnostics] Could not open document:', error);
          return [];
        }
      }

      // Poll for diagnostics with retries until they appear or timeout
      console.log(`[Diagnostics] Polling for diagnostics (timeout: ${timeout}ms, interval: ${delay}ms)...`);
      const startTime = Date.now();
      const pollInterval = delay;
      let vscDiagnostics: vscode.Diagnostic[] = [];
      let attempts = 0;

      while (Date.now() - startTime < timeout) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        
        vscDiagnostics = vscode.languages.getDiagnostics(uri);
        console.log(`[Diagnostics] Attempt ${attempts}: Found ${vscDiagnostics.length} total diagnostics`);
        
        // If we found diagnostics, break early
        if (vscDiagnostics.length > 0) {
          console.log(`[Diagnostics] Diagnostics detected after ${Date.now() - startTime}ms`);
          break;
        }
      }

      if (vscDiagnostics.length === 0) {
        console.log(`[Diagnostics] No diagnostics found after ${Date.now() - startTime}ms (timeout)`);
      }

      // Filter by severity and convert to our format
      const filtered = vscDiagnostics
        .filter((d) => severities.includes(d.severity))
        .map((d) => this.convertDiagnostic(d));

      console.log(`[Diagnostics] Filtered to ${filtered.length} diagnostics (Errors/Warnings)`);
      
      return filtered;
    } catch (error) {
      console.error('[Diagnostics] Error capturing diagnostics:', error);
      return [];
    }
  }

  /**
   * Convert VS Code Diagnostic to our simplified format
   */
  private convertDiagnostic(diagnostic: vscode.Diagnostic): CapturedDiagnostic {
    return {
      line: diagnostic.range.start.line + 1, // Convert to 1-indexed
      character: diagnostic.range.start.character,
      severity: this.severityToString(diagnostic.severity),
      message: diagnostic.message,
      source: diagnostic.source,
      code: typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code,
    };
  }

  /**
   * Convert VS Code DiagnosticSeverity enum to string
   */
  private severityToString(
    severity: vscode.DiagnosticSeverity
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

  /**
   * Format diagnostics for LLM consumption (continuation prompt)
   */
  formatDiagnosticsForLLM(
    diagnostics: CapturedDiagnostic[],
    filePath: string
  ): string {
    if (diagnostics.length === 0) {
      return '';
    }

    const lines = diagnostics.map((d) => {
      const source = d.source ? ` (${d.source})` : '';
      const code = d.code ? ` [${d.code}]` : '';
      return `- Line ${d.line}: [${d.severity}] ${d.message}${code}${source}`;
    });

    return `<file_diagnostics>
File: ${filePath}
Issues detected after your edit (${diagnostics.length} total):

${lines.join('\n')}

[INSTRUCTION: The file you just modified has lint/compile errors. Review the diagnostics above and use edit_file or multi_edit to fix them. This is an opportunity to correct the issues before proceeding.]
</file_diagnostics>`;
  }

  /**
   * Get configuration setting
   */
  getConfig<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration('echode.diagnostics');
    return config.get<T>(key, defaultValue);
  }

  /**
   * Check if diagnostics feature is enabled
   */
  isEnabled(): boolean {
    return this.getConfig('enabled', true);
  }
}
