import { Terminal } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode, type ToolProgressCallback } from '../tool-utils';

/**
 * Run Terminal Tool
 */
async function executeRunTerminal(
    parameters: Record<string, unknown>,
    signal?: AbortSignal,
    _onStatusChange?: unknown,
    onProgress?: ToolProgressCallback,
    mode?: ChatMode,
): Promise<ToolExecutionResult> {
    return executeToolViaExtension('run_terminal', parameters, signal, onProgress, mode);
}

// Register run_terminal tool
registerToolPlugin({
    metadata: {
        id: 'run_terminal',
        name: 'Run Terminal',
        description: 'Execute commands in a persistent shell session',
        aiDescription: `Execute commands in a persistent shell session. Fire-and-forget execution with polling for output.

Parameters:
- mode: "execute" | "read" | "stop" (required)
- command: Command to run (required for "execute" mode)
- id: Session ID (optional, default: "default")
- timeout: Wait time in seconds (required for "read" mode, e.g., 10-30)

Usage: Always use "execute" then "read" with timeout to get streaming output.`,
        icon: Terminal,
        usage: 'Run terminal command',
        formatExample: '<function_calls>\n<invoke name="run_terminal">\n<parameter name="mode">execute</parameter>\n<parameter name="command">npm install</parameter>\n</invoke>\n<invoke name="run_terminal">\n<parameter name="mode">read</parameter>\n<parameter name="timeout">30</parameter>\n</invoke>\n</function_calls>',
    },
    handler: {
        execute: executeRunTerminal,
    },
    renderer: (data: unknown) => {
        if (typeof data === 'string') {
            return (
                <div className="space-y-2">
                    <div className="text-xs font-semibold opacity-70 flex items-center gap-1">
                        <Terminal size={12} />
                        <span>Terminal Output</span>
                    </div>
                    <pre
                        className="text-xs font-mono whitespace-pre-wrap overflow-x-auto p-2 rounded"
                        style={{
                            backgroundColor: 'var(--vscode-textCodeBlock-background)',
                            color: 'var(--vscode-editor-foreground)',
                        }}
                    >
                        {data}
                    </pre>
                </div>
            );
        }
        return <div className="text-xs opacity-70">Command executed successfully</div>;
    },
});
