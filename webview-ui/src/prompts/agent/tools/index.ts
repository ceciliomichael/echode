/**
 * Agent Mode - Tool Instructions
 * Uses shared tool factories for consistency across modes
 */

import type { Tool } from '../../../types/tool';
import {
    getReadFileInstructions,
    getEditInstructions,
    getWriteFileInstructions,
    getGrepSearchInstructions,
    getGlobSearchInstructions,
    getListFilesInstructions,
    getDeleteFileInstructions,
    getGetDiagnosticsInstructions,
    getTodoWriteInstructions,
    getRunTerminalInstructions,
    getCreateSubagentInstructions,
    getUseSubagentInstructions,
} from '../../shared/tools';

/** Standard tool instructions that take no parameters */
const TOOL_INSTRUCTION_MAP: Record<string, () => string> = {
    'read_file': () => getReadFileInstructions(),
    'edit': getEditInstructions,
    'write_to_file': getWriteFileInstructions,
    'grep_search': () => getGrepSearchInstructions(),
    'glob_search': () => getGlobSearchInstructions(),
    'list_files': () => getListFilesInstructions(),
    'delete_file': () => getDeleteFileInstructions(),
    'get_diagnostics': () => getGetDiagnosticsInstructions(),
    'todo_write': () => getTodoWriteInstructions(),
    'create_subagent': getCreateSubagentInstructions,
    'use_subagent': getUseSubagentInstructions,
};

export interface ToolInstructionOptions {
    /** Enable full terminal access (bypass command restrictions) */
    fullTerminalAccess?: boolean;
}

/**
 * Get tool instructions for Agent mode based on enabled tools
 * @param enabledTools - List of enabled tools
 * @param options - Additional options for tool instructions
 */
export function getAgentToolInstructions(
    enabledTools: Tool[],
    options: ToolInstructionOptions = {}
): string {
    const { fullTerminalAccess = false } = options;

    const instructions = enabledTools
        .map(tool => {
            // Handle run_terminal specially since it needs the fullAccess parameter
            if (tool.id === 'run_terminal') {
                return getRunTerminalInstructions({ fullAccessEnabled: fullTerminalAccess });
            }
            const getInstructions = TOOL_INSTRUCTION_MAP[tool.id];
            return getInstructions ? getInstructions() : '';
        })
        .filter(Boolean);

    if (instructions.length === 0) {return '';}

    return `<tool_instructions>
${instructions.join('\n\n')}
</tool_instructions>`;
}