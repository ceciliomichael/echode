/**
 * General Mode - Tool Instructions
 * Exports mode-specific instructions for file operations mode
 */

import type { Tool } from '../../../types/tool';

// Import individual tool instructions
import { getReadFileInstructions } from './read-file';
import { getApplyDiffInstructions } from './apply-diff';
import { getWriteFileInstructions } from './write-file';
import { getListFilesInstructions } from './list-files';
import { getDeleteFileInstructions } from './delete-file';

const TOOL_INSTRUCTION_MAP: Record<string, () => string> = {
    'read_file': getReadFileInstructions,
    'apply_diff': getApplyDiffInstructions,
    'write_to_file': getWriteFileInstructions,
    'list_files': getListFilesInstructions,
    'delete_file': getDeleteFileInstructions,
};

/**
 * Get tool instructions for General mode based on enabled tools
 */
export function getGeneralToolInstructions(enabledTools: Tool[]): string {
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
