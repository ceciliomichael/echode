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
  const infoCount = file.diagnostics.filter(d => d.severity === 'Information').length;
  const hintCount = file.diagnostics.filter(d => d.severity === 'Hint').length;

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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {errorCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-errorForeground)]">
              {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-editorWarning-foreground)]">
              {warningCount}
            </span>
          )}
          {infoCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--vscode-inputValidation-infoBackground)] text-[var(--vscode-editorInfo-foreground)]">
              {infoCount}
            </span>
          )}
          {hintCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full opacity-60" style={{ background: 'var(--vscode-editor-background)' }}>
              {hintCount}
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
    description: 'Collect linter/compiler diagnostics from the workspace',
    icon: AlertTriangle,
    usage: 'Get linter/compiler errors and warnings',
    formatExample: '<function_calls>\n<invoke name="get_diagnostics">\n<parameter name="path">src</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeGetDiagnostics,
  },
  renderer: (data: unknown) => <DiagnosticsRendererComponent data={data} />,
});

export { DiagnosticFileItem };
