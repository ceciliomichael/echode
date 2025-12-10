/**
 * Ask Mode - Main prompt builder
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getIdentity, getFocusInstruction, getUserRules, getSystemInfo } from '../shared';
import { getAskModeSection } from './mode-section';
import { getAskRules } from './rules';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface AskPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
    name?: string;
    purpose?: string;
}

/**
 * Build the complete Ask mode system prompt
 */
export function buildAskPrompt(options: AskPromptOptions): string {
    const { workspace, enabledTools, name, purpose } = options;

    const identity = getIdentity('ask', { name, purpose });
    const focus = getFocusInstruction();

    // Tool-related sections (read-only tools only)
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    const rules = getAskRules(workspace);
    const modeSection = getAskModeSection();
    const userRules = getUserRules(workspace);
    const systemInfo = getSystemInfo(workspace);

    // Assemble - Ask mode is simpler, no cognitive workflow or tool chains
    const sections = [
        identity,
        focus,
        toolsSection,
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
export { getAskSystemReminder, getAskTodoReminder } from './reminders';
