import { Terminal } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode, type ToolProgressCallback } from '../tool-utils';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';

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
        formatExample: `${TOOL_FUNCTION_CALLS_OPEN}\n<${TOOL_XML_NAMESPACE}:invoke name="run_terminal">\n<${TOOL_XML_NAMESPACE}:parameter name="mode">execute</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="command">npm install</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>\n<${TOOL_XML_NAMESPACE}:invoke name="run_terminal">\n<${TOOL_XML_NAMESPACE}:parameter name="mode">read</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="timeout">30</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>\n${TOOL_FUNCTION_CALLS_CLOSE}`,
    },
    handler: {
        execute: executeRunTerminal,
    },
    renderer: (data: unknown) => {
        // Determine display content - prefer progress (streamed output) over result data
        let displayContent = '';
        
        if (typeof data === 'string') {
            // Direct string data
            displayContent = data;
        } else if (typeof data === 'object' && data !== null) {
            const result = data as { 
                command?: string; 
                output?: string; 
                exitCode?: number;
                progress?: string;  // Streamed progress passed from tool-block-content
            };
            
            // Prefer progress (contains full streamed output with command prefix)
            if (typeof result.progress === 'string' && result.progress) {
                displayContent = result.progress;
            } else {
                // Fallback to result data
                const command = result.command || '';
                const output = result.output || '';
                displayContent = command ? `$ ${command}\n${output}` : output;
            }
        }
        
        return (
            <div className="w-full flex-1 min-h-0 flex flex-col rounded-xl overflow-hidden border border-[var(--vscode-input-border)]">
                {/* Header */}
                <div
                    className="flex-shrink-0 flex items-center justify-between px-3 py-2 text-xs font-medium border-b"
                    style={{
                        backgroundColor: 'var(--vscode-editor-background)',
                        borderColor: 'var(--vscode-input-border)',
                        color: 'var(--vscode-descriptionForeground)',
                    }}
                >
                    <span>Terminal Output</span>
                </div>

                {/* Content - scrollable area with fixed max height */}
                <div
                    className="text-xs font-mono overflow-auto max-h-[340px]"
                    style={{
                        backgroundColor: 'var(--vscode-editor-background)',
                    }}
                >
                    <pre
                        className="px-3 py-2 whitespace-pre-wrap m-0 leading-[1.15rem]"
                        style={{
                            color: 'var(--vscode-editor-foreground)',
                        }}
                    >
                        {displayContent || '(No output)'}
                    </pre>
                </div>
            </div>
        );
    },
});
