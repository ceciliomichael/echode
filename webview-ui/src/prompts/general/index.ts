/**
 * General Mode - Main prompt builder
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getIdentity, getFocusInstruction, getUserRules, getSystemInfo } from '../shared';
import { getGeneralModeSection } from './mode-section';
import { getGeneralRules } from './rules';
import { getGeneralToolInstructions } from './tools';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface GeneralPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
    name?: string;
}

/**
 * Build the complete General mode system prompt
 */
export function buildGeneralPrompt(options: GeneralPromptOptions): string {
    const { workspace, enabledTools, name } = options;

    const identity = getIdentity('general', { name });
    const focus = getFocusInstruction();

    // Tool format section
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Mode-specific tool instructions
    const toolInstructions = getGeneralToolInstructions(enabledTools);

    const rules = getGeneralRules(workspace);
    const modeSection = getGeneralModeSection();
    const userRules = getUserRules(workspace);
    const systemInfo = getSystemInfo(workspace);

    // Assemble
    const sections = [
        identity,
        focus,
        toolsSection,
        toolInstructions,
        rules,
        modeSection,
        userRules,
        systemInfo,
    ].filter(Boolean);

    return sections.join('\n\n').trim();
}

// Re-export components
export { getGeneralModeSection } from './mode-section';
export { getGeneralRules } from './rules';
export { getGeneralToolInstructions } from './tools';
export { getGeneralSystemReminder, getGeneralTodoReminder } from './reminders';
