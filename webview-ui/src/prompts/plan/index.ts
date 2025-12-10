/**
 * Plan Mode - Main prompt builder
 * Assembles the complete Plan mode system prompt
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getIdentity, getFocusInstruction, getUserRules, getSystemInfo } from '../shared';
import { getPlanModeSection } from './mode-section';
import { getPlanRules } from './rules';
import { getPlanCognitiveWorkflow } from './cognitive-workflow';
import { getPlanToolChains } from './tool-chains';
import { getPlanToolInstructions } from './tools';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface PlanPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
    name?: string;
    purpose?: string;
}

/**
 * Build the complete Plan mode system prompt
 */
export function buildPlanPrompt(options: PlanPromptOptions): string {
    const { workspace, enabledTools, name, purpose } = options;

    const identity = getIdentity('plan', { name, purpose });
    const focus = getFocusInstruction();
    const cognitiveWorkflow = getPlanCognitiveWorkflow();

    // Tool format section (generic XML format)
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Mode-specific tool instructions (Plan-specific, no editing tool mentions)
    const toolInstructions = getPlanToolInstructions(enabledTools);

    const toolChains = getPlanToolChains(enabledTools);
    const rules = getPlanRules(workspace);
    const modeSection = getPlanModeSection();
    const userRules = getUserRules(workspace);
    const systemInfo = getSystemInfo(workspace);

    // Assemble in priority order
    const sections = [
        identity,
        focus,
        cognitiveWorkflow,
        toolsSection,
        toolInstructions,
        toolChains,
        rules,
        modeSection,
        userRules,
        systemInfo,
    ].filter(Boolean);

    return sections.join('\n\n').trim();
}

// Re-export components
export { getPlanModeSection } from './mode-section';
export { getPlanRules } from './rules';
export { getPlanCognitiveWorkflow } from './cognitive-workflow';
export { getPlanToolChains } from './tool-chains';
export { getPlanToolInstructions } from './tools';
export { getPlanSystemReminder, getPlanTodoReminder } from './reminders';
