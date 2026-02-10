/**
 * General Mode - Main prompt builder
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules, getSystemInfo } from '../shared';
import { getGeneralPrompt } from './prompt';
import { getGeneralToolInstructions } from './tools';
import type { ToolInstructionOptions } from './tools';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface GeneralPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
    model?: string;
    /** Enable full terminal access (bypass command restrictions) */
    fullTerminalAccess?: boolean;
}

/**
 * Build the complete General mode system prompt
 */
export function buildGeneralPrompt(options: GeneralPromptOptions): string {
    const { workspace, enabledTools, fullTerminalAccess = false, model } = options;

    // Tool format section
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools, model)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Build tool instruction options
    const toolOptions: ToolInstructionOptions = {
        fullTerminalAccess,
        shellType: workspace?.shellType,
    };

    // Mode-specific tool instructions
    const toolInstructions = getGeneralToolInstructions(enabledTools, toolOptions);

    // Monolithic prompt (rules + mode description)
    const prompt = getGeneralPrompt(workspace, enabledTools);

    const userRules = getUserRules(workspace);
    const terminalEnabled = enabledTools.some(t => t.id === 'run_terminal');
    const systemInfo = getSystemInfo(workspace, { terminalEnabled });

    // Assemble
    const sections = [
        prompt,
        toolsSection,
        toolInstructions,
        userRules,
        systemInfo,
    ].filter(Boolean);

    return sections.join('\n\n').trim();
}

// Re-export components
export { getGeneralToolInstructions } from './tools';
export type { ToolInstructionOptions } from './tools';