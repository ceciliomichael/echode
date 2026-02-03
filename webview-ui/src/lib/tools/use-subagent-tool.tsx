import { Play } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';

async function executeUseSubAgent(
    parameters: Record<string, unknown>,
    signal?: AbortSignal,
    _onStatusChange?: unknown,
    _onProgress?: unknown,
    mode?: ChatMode,
): Promise<ToolExecutionResult> {
    return executeToolViaExtension('use_subagent', parameters, signal, undefined, mode);
}

registerToolPlugin({
    metadata: {
        id: 'use_subagent',
        name: 'Use Sub-Agent',
        description: 'Delegate a task to a sub-agent',
        aiDescription: `Delegate a task to a previously created sub-agent. Opens a new panel where the agent works autonomously and returns results when done.

Parameters:
- subAgentName: (required) The EXACT name you used when calling create_subagent (e.g., "code_reviewer")
- task: (required) The specific task for the sub-agent to perform

NOTE: You must call create_subagent first to create the sub-agent before using this tool.`,
        icon: Play,
        usage: 'Start sub-agent task',
        formatExample: `${TOOL_FUNCTION_CALLS_OPEN}\n<${TOOL_XML_NAMESPACE}:invoke name="use_subagent">\n<${TOOL_XML_NAMESPACE}:parameter name="subAgentName">code_reviewer</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="task">Review src/app.ts</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>\n${TOOL_FUNCTION_CALLS_CLOSE}`,
    },
    handler: {
        execute: executeUseSubAgent,
    },
    renderer: (data: unknown) => {
        if (typeof data === 'string') {
             try {
                const result = JSON.parse(data);
                return (
                    <div className="text-xs">
                        <div className="font-semibold text-green-500">Sub-Agent Completed</div>
                        <div className="mt-1 font-semibold opacity-70">Result:</div>
                        <pre className="whitespace-pre-wrap opacity-90">{JSON.stringify(result.result, null, 2)}</pre>
                    </div>
                );
            } catch (e) {
                // If not JSON
            }
        }
        return <div className="text-xs opacity-70">Sub-agent task completed</div>;
    },
});