/**
 * Ask Mode - Main prompt builder
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules, getSystemInfo } from '../shared';
import { getAskModeSection } from './mode-section';
import { getAskRules } from './rules';
import { getAskToolInstructions } from './tools';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface AskPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
}

/**
 * Build the complete Ask mode system prompt
 */
export function buildAskPrompt(options: AskPromptOptions): string {
    const { workspace, enabledTools } = options;

    // Tool format section
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Mode-specific tool instructions (Ask-specific, no editing mentions)
    const toolInstructions = getAskToolInstructions(enabledTools);

    const rules = getAskRules(workspace);
    const modeSection = getAskModeSection();
    const userRules = getUserRules(workspace);
    const systemInfo = getSystemInfo(workspace);

    // Assemble
    const sections = [
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
export { getAskModeSection } from './mode-section';
export { getAskRules } from './rules';
export { getAskToolInstructions } from './tools';
export { getAskSystemReminder, getAskTodoReminder } from './reminders';
