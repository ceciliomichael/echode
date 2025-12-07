import { AlertTriangle, AlertCircle, Info, Lightbulb, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { getFileIconConfig } from '../../utils/file-icon-mapper';

interface DiagnosticItem {
  line: number;
  character: number;
  severity: 'Error' | 'Warning' | 'Information' | 'Hint';
  message: string;
  source?: string;
  code?: string | number;
}

interface DiagnosticFileResult {
  filePath: string;
  diagnostics: DiagnosticItem[];
}

interface DiagnosticFileItemProps {
  file: DiagnosticFileResult;
  isExpanded: boolean;
  onToggle: () => void;
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'Error':
      return <AlertCircle className="w-3 h-3 text-[var(--vscode-errorForeground)]" />;
    case 'Warning':
      return <AlertTriangle className="w-3 h-3 text-[var(--vscode-editorWarning-foreground)]" />;
    case 'Information':
      return <Info className="w-3 h-3 text-[var(--vscode-editorInfo-foreground)]" />;
    case 'Hint':
      return <Lightbulb className="w-3 h-3 opacity-60" />;
    default:
      return <AlertCircle className="w-3 h-3 opacity-60" />;
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'Error':
      return 'var(--vscode-errorForeground)';
    case 'Warning':
      return 'var(--vscode-editorWarning-foreground)';
    case 'Information':
      return 'var(--vscode-editorInfo-foreground)';
    default:
      return 'var(--vscode-foreground)';
  }
}

function DiagnosticFileItem({ file, isExpanded, onToggle }: DiagnosticFileItemProps) {
  const iconConfig = getFileIconConfig(file.filePath);
  const Icon = iconConfig.icon;
  
  const errorCount = file.diagnostics.filter(d => d.severity === 'Error').length;
  const warningCount = file.diagnostics.filter(d => d.severity === 'Warning').length;
  
  return (
    <div className="border-b border-[var(--vscode-input-border)] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 opacity-50 flex-shrink-0" />
        )}
        <Icon
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: iconConfig.color }}
        />
        <span
          className="text-xs font-medium truncate flex-1 min-w-0"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          {file.filePath}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {errorCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-errorForeground)]">
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-editorWarning-foreground)]">
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="border-t border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
          <div className="px-3 py-2 space-y-2">
            {file.diagnostics.map((diag, diagIndex) => (
              <div
                key={diagIndex}
                className="flex items-start gap-2 text-xs"
              >
                <span className="flex-shrink-0 mt-0.5">
                  {getSeverityIcon(diag.severity)}
                </span>
                <span
                  className="font-mono opacity-70 flex-shrink-0"
                  style={{ minWidth: '4.5rem' }}
                >
                  L{diag.line}:{diag.character}
                </span>
                <span className="flex-1" style={{ color: getSeverityColor(diag.severity) }}>
                  {diag.message}
                  {diag.code && (
                    <span className="opacity-60 ml-1">[{diag.code}]</span>
                  )}
                  {diag.source && (
                    <span className="opacity-50 ml-1">({diag.source})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiagnosticsRendererComponent({ data }: { data: unknown }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (typeof data === 'object' && data !== null) {
    const result = data as {
      files: DiagnosticFileResult[];
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
      <div className="rounded-xl overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
        <div className="max-h-[400px] overflow-y-auto">
          {result.files.map((file, index) => (
            <DiagnosticFileItem
              key={index}
              file={file}
              isExpanded={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    );
  }

  return <div className="text-xs opacity-70">Diagnostics collected.</div>;
}

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
Description: Collect all available diagnostics (lint/compile errors and warnings, plus information and hints) from the workspace as reported by the language servers.

Primary purpose:
- Use this tool near the END of an implementation flow to verify that your edits did not introduce new errors.
- If diagnostics are returned, you should usually perform another round of fixes (e.g., with write_to_file or apply_diff) before declaring the task complete.

Parameters:
- path: (optional) Target within the workspace. Can be either a specific file path (e.g., "src/app.ts") or a directory path (e.g., "src"). When provided, diagnostics are limited to that file or to files under that directory.
- file_pattern: (optional) Plain string used to filter files by path substring (e.g., "src/" or ".ts"). Only used when path is not provided. When omitted, diagnostics for all files are returned.

Recommended usage patterns:
1. Final workspace check before completion (entire workspace):
<function_calls>
<invoke name="get_diagnostics">
</invoke>
</function_calls>

2. Focus diagnostics on a specific directory:
<function_calls>
<invoke name="get_diagnostics">
<parameter name="path">src</parameter>
</invoke>
</function_calls>

3. Focus diagnostics on a specific file:
<function_calls>
<invoke name="get_diagnostics">
<parameter name="path">src/app.ts</parameter>
</invoke>
</function_calls>

Handling results:
- If totalDiagnostics is 0: You can safely report that no diagnostics were found.
- If diagnostics exist: summarize them for the user and consider applying fixes before finishing.`,
    icon: AlertTriangle,
    usage: 'Collect linter/compiler diagnostics for the current workspace, a directory, or a specific file',
    formatExample:
      '<function_calls>\n<invoke name="get_diagnostics">\n<parameter name="path">src</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeGetDiagnostics,
  },
  renderer: (data: unknown) => <DiagnosticsRendererComponent data={data} />,
});

export { DiagnosticFileItem };
