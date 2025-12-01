import { AlertTriangle } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';

async function executeGetDiagnostics(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('get_diagnostics', parameters, signal);
}

registerToolPlugin({
  metadata: {
    id: 'get_diagnostics',
    name: 'Get Diagnostics',
    description: 'Collect current linter/compiler diagnostics from the workspace',
    aiDescription: `## get_diagnostics
Description: Collect all available diagnostics (lint/compile errors and warnings) from the workspace as reported by the language servers.

Primary purpose:
- Use this tool near the END of an implementation flow in AGENT mode to verify that your edits did not introduce new errors.
- If diagnostics are returned, you should usually perform another round of fixes (e.g., with write_to_file or apply_diff) before declaring the task complete.

Parameters:
- include_warnings: (optional, default: true) If false, only errors are returned. If true or omitted, errors + warnings + information/hints are returned.
- file_pattern: (optional) Plain string used to filter files by path substring (e.g., "src/" or ".ts"). When omitted, diagnostics for all files are returned.

Recommended usage patterns:
1. Final workspace check before completion:
<function_calls>
<invoke name="get_diagnostics">
<parameter name="include_warnings">true</parameter>
</invoke>
</function_calls>

2. Focus diagnostics on a specific area:
<function_calls>
<invoke name="get_diagnostics">
<parameter name="file_pattern">src/</parameter>
<parameter name="include_warnings">true</parameter>
</invoke>
</function_calls>

Handling results:
- If totalDiagnostics is 0: You can safely report that no diagnostics were found.
- If diagnostics exist: summarize them for the user and consider applying fixes before finishing.`,
    icon: AlertTriangle,
    usage: 'Collect linter/compiler diagnostics for the current workspace',
    formatExample:
      '<function_calls>\n<invoke name="get_diagnostics">\n<parameter name="include_warnings">true</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeGetDiagnostics,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      const result = data as {
        files: Array<{
          filePath: string;
          diagnostics: Array<{
            line: number;
            character: number;
            severity: 'Error' | 'Warning' | 'Information' | 'Hint';
            message: string;
            source?: string;
            code?: string | number;
          }>;
        }>;
        totalFilesWithDiagnostics: number;
        totalDiagnostics: number;
      };

      if (!result.files || result.files.length === 0) {
        return (
          <div className="text-xs opacity-70">
            No diagnostics reported by the language server.
          </div>
        );
      }

      return (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Diagnostics overview</span>
            </div>
            <span className="opacity-70">
              {result.totalDiagnostics} issue{result.totalDiagnostics === 1 ? '' : 's'} in {result.totalFilesWithDiagnostics}{' '}
              file{result.totalFilesWithDiagnostics === 1 ? '' : 's'}
            </span>
          </div>

          <div className="max-h-[320px] overflow-y-auto border border-[var(--vscode-input-border)] rounded-md">
            {result.files.map((file, fileIndex) => (
              <div
                key={fileIndex}
                className="border-b last:border-b-0 border-[var(--vscode-input-border)]"
              >
                <div className="px-3 py-1.5 bg-[var(--vscode-sideBar-background)] flex items-center justify-between">
                  <span className="font-mono truncate mr-2">{file.filePath}</span>
                  <span className="opacity-70">
                    {file.diagnostics.length} issue{file.diagnostics.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="px-3 py-1.5 space-y-1.5">
                  {file.diagnostics.map((diag, diagIndex) => (
                    <div key={diagIndex} className="flex gap-2">
                      <span className="font-mono opacity-60 w-16 flex-shrink-0">
                        L{diag.line}:{diag.character}
                      </span>
                      <span className="font-semibold flex-shrink-0 w-20">
                        {diag.severity}
                      </span>
                      <span className="flex-1">
                        {diag.message}
                        {diag.code ? ` [${diag.code}]` : ''}
                        {diag.source ? ` (${diag.source})` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return <div className="text-xs opacity-70">Diagnostics collected.</div>;
  },
});
