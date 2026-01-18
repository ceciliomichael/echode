import { FileText } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';

/**
 * Read File Tool
 */
async function executeReadFile(
    parameters: Record<string, unknown>,
    signal?: AbortSignal,
    _onStatusChange?: unknown,
    _onProgress?: unknown,
    mode?: ChatMode,
): Promise<ToolExecutionResult> {
    return executeToolViaExtension('read_file', parameters, signal, undefined, mode);
}

// Register read_file tool
registerToolPlugin({
    metadata: {
        id: 'read_file',
        name: 'Read File',
        description: 'Read file contents with line numbers',
        aiDescription: `Read file contents. Returns line-numbered output.

Parameters:
- path: (required) File path with extension
- offset: (optional) Start line (1-based)
- limit: (optional) Lines to read (default: 500)`,
        icon: FileText,
        usage: 'Read file content',
        formatExample: '<function_calls>\n<invoke name="read_file">\n<parameter name="path">src/app.ts</parameter>\n</invoke>\n</function_calls>',
    },
    handler: {
        execute: executeReadFile,
    },
    renderer: (data: unknown) => {
        if (typeof data === 'object' && data !== null) {
            if ('content' in data) {
                const result = data as {
                    content: string;
                    path: string;
                    startLine?: number;
                    endLine?: number;
                    totalLines?: number;
                };

                const lineRangeText = result.startLine && result.endLine
                    ? `Lines ${result.startLine}-${result.endLine}`
                    : result.totalLines
                        ? `${result.totalLines} lines`
                        : '';

                return (
                    <div className="flex flex-col flex-1 min-h-0">
                        <div className="flex items-center justify-between text-xs font-semibold opacity-70 px-3 py-2 shrink-0">
                            <span>File: {result.path}</span>
                            {lineRangeText && <span>{lineRangeText}</span>}
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
                            <pre
                                className="text-xs font-mono whitespace-pre-wrap overflow-x-auto p-2 rounded"
                                style={{
                                    backgroundColor: 'var(--vscode-textCodeBlock-background)',
                                    color: 'var(--vscode-editor-foreground)',
                                }}
                            >
                                {result.content}
                            </pre>
                        </div>
                    </div>
                );
            }
        }
        return <div className="text-xs opacity-70">File read successfully</div>;
    },
});
