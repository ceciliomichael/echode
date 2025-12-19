/**
 * Plan Mode - Tool Instructions
 * Exports mode-specific instructions for each tool available in Plan mode
 * NOTE: NO editing tools (apply_diff, write_to_file, delete_file) exist in Plan mode
 */

import type { Tool } from '../../../types/tool';

// Import individual tool instructions
import { getReadFileInstructions } from './read-file';
import { getEchoSearchInstructions } from './echo-search';
import { getGrepSearchInstructions } from './grep-search';
import { getGlobSearchInstructions } from './glob-search';
import { getListFilesInstructions } from './list-files';
import { getTodoWriteInstructions } from './todo-write';
import { getTodoReadInstructions } from './todo-read';
import { getPlanInstructions } from './plan';

const TOOL_INSTRUCTION_MAP: Record<string, () => string> = {
    'read_file': getReadFileInstructions,
    'echo_search': getEchoSearchInstructions,
    'grep_search': getGrepSearchInstructions,
    'glob_search': getGlobSearchInstructions,
    'list_files': getListFilesInstructions,
    'todo_write': getTodoWriteInstructions,
    'todo_read': getTodoReadInstructions,
    'plan': getPlanInstructions,
};

/**
 * Get tool instructions for Plan mode based on enabled tools
 */
export function getPlanToolInstructions(enabledTools: Tool[]): string {
    const instructions = enabledTools
        .map(tool => {
            const getInstructions = TOOL_INSTRUCTION_MAP[tool.id];
            return getInstructions ? getInstructions() : '';
        })
        .filter(Boolean);

    if (instructions.length === 0) return '';

    return `<tool_instructions>
${instructions.join('\n\n')}
</tool_instructions>`;
}
