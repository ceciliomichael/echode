/**
 * Agent Mode - Tool Instructions
 * Exports mode-specific instructions for each tool available in Agent mode
 */

import type { Tool } from '../../../types/tool';

// Import individual tool instructions
import { getReadFileInstructions } from './read-file';
import { getApplyDiffInstructions } from './apply-diff';
import { getWriteFileInstructions } from './write-file';
import { getEchoSearchInstructions } from './echo-search';
import { getGrepSearchInstructions } from './grep-search';
import { getGlobSearchInstructions } from './glob-search';
import { getListFilesInstructions } from './list-files';
import { getDeleteFileInstructions } from './delete-file';
import { getGetDiagnosticsInstructions } from './get-diagnostics';
import { getTodoWriteInstructions } from './todo-write';
import { getTodoReadInstructions } from './todo-read';
import { getRunTerminalInstructions } from './run-terminal';

/** Standard tool instructions that take no parameters */
const TOOL_INSTRUCTION_MAP: Record<string, () => string> = {
    'read_file': getReadFileInstructions,
    'apply_diff': getApplyDiffInstructions,
    'write_to_file': getWriteFileInstructions,
    'echo_search': getEchoSearchInstructions,
    'grep_search': getGrepSearchInstructions,
    'glob_search': getGlobSearchInstructions,
    'list_files': getListFilesInstructions,
    'delete_file': getDeleteFileInstructions,
    'get_diagnostics': getGetDiagnosticsInstructions,
    'todo_write': getTodoWriteInstructions,
    'todo_read': getTodoReadInstructions,
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
                return getRunTerminalInstructions(fullTerminalAccess);
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
