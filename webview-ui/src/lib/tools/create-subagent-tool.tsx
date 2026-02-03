import { Bot } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';

async function executeCreateSubAgent(
    parameters: Record<string, unknown>,
    signal?: AbortSignal,
    _onStatusChange?: unknown,
    _onProgress?: unknown,
    mode?: ChatMode,
): Promise<ToolExecutionResult> {
    return executeToolViaExtension('create_subagent', parameters, signal, undefined, mode);
}

registerToolPlugin({
    metadata: {
        id: 'create_subagent',
        name: 'Create Sub-Agent',
        description: 'Create a new autonomous sub-agent',
        aiDescription: `Create a new sub-agent with a specific persona and allowed tools. After creation, use the use_subagent tool with the SAME NAME to delegate tasks.

Parameters:
- name: (required) A simple name for the sub-agent (e.g., "code_reviewer", "file_analyzer"). Use this same name later with use_subagent.
- persona: (required) The system prompt/persona describing the sub-agent's role and behavior
- workflow: (optional) Workflow steps or instructions for the sub-agent to follow
- allowedTools: (required) Array of tool names the sub-agent can use (e.g., ["read_file", "grep_search"])

IMPORTANT: After creating, call use_subagent with subAgentName set to the EXACT name you used here.`,
        icon: Bot,
        usage: 'Create new sub-agent',
        formatExample: `${TOOL_FUNCTION_CALLS_OPEN}\n<${TOOL_XML_NAMESPACE}:invoke name="create_subagent">\n<${TOOL_XML_NAMESPACE}:parameter name="name">Code Reviewer</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="persona">You are an expert code reviewer.</${TOOL_XML_NAMESPACE}:parameter>\n<${TOOL_XML_NAMESPACE}:parameter name="allowedTools">["read_file", "report_back"]</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>\n${TOOL_FUNCTION_CALLS_CLOSE}`,
    },
    handler: {
        execute: executeCreateSubAgent,
    },
    renderer: (data: unknown) => {
        if (typeof data === 'string') {
            try {
                const result = JSON.parse(data);
                return (
                    <div className="text-xs">
                        <div className="font-semibold text-green-500">Sub-Agent Created: {result.name}</div>
                        <div className="opacity-70 mt-1">Use <code className="bg-black/20 px-1 rounded">use_subagent</code> with <code className="bg-black/20 px-1 rounded">subAgentName="{result.name}"</code> to delegate tasks.</div>
                    </div>
                );
            } catch (e) {
                // If not JSON, render raw
            }
        }
        return <div className="text-xs opacity-70">Sub-agent created successfully</div>;
    },
});