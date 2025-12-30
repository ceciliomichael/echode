/**
 * General Mode - Tool Instructions
 * Uses shared tool factories for consistency across modes
 */

import type { Tool } from '../../../types/tool';
import {
    getReadFileInstructions,
    getApplyDiffInstructions,
    getWriteFileInstructions,
    getListFilesInstructions,
    getDeleteFileInstructions,
    getGetDiagnosticsInstructions,
} from '../../shared/tools';

const TOOL_INSTRUCTION_MAP: Record<string, () => string> = {
    'read_file': () => getReadFileInstructions(),
    'apply_diff': getApplyDiffInstructions,
    'write_to_file': getWriteFileInstructions,
    'list_files': () => getListFilesInstructions(),
    'delete_file': () => getDeleteFileInstructions(),
    'get_diagnostics': () => getGetDiagnosticsInstructions(),
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

    if (instructions.length === 0) {return '';}

    return `<tool_instructions>
${instructions.join('\n\n')}
</tool_instructions>`;
}