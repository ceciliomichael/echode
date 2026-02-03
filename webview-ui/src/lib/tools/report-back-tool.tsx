import { Send } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';

async function executeReportBack(
    parameters: Record<string, unknown>,
    signal?: AbortSignal,
    _onStatusChange?: unknown,
    _onProgress?: unknown,
    mode?: ChatMode,
): Promise<ToolExecutionResult> {
    return executeToolViaExtension('report_back', parameters, signal, undefined, mode);
}

registerToolPlugin({
    metadata: {
        id: 'report_back',
        name: 'Report Back',
        description: 'Report final result to main agent',
        aiDescription: `Report the final result back to the main agent and end the session.

Parameters:
- result: (required) The result data object

Note: Session tracking is automatic - you don't need to provide a session ID.`,
        icon: Send,
        usage: 'Report result',
        formatExample: `${TOOL_FUNCTION_CALLS_OPEN}\n<${TOOL_XML_NAMESPACE}:invoke name="report_back">\n<${TOOL_XML_NAMESPACE}:parameter name="result">{"status":"ok","data":"your results here"}</${TOOL_XML_NAMESPACE}:parameter>\n</${TOOL_XML_NAMESPACE}:invoke>\n${TOOL_FUNCTION_CALLS_CLOSE}`,
        hidden: true,
    },
    handler: {
        execute: executeReportBack,
    },
    renderer: (_data: unknown) => {
        return <div className="text-xs font-semibold text-blue-500">Result reported back. Session complete.</div>;
    },
});