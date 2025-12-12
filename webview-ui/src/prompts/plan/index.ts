/**
 * Plan Mode - Main prompt builder
 * Assembles the complete Plan mode system prompt
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules, getSystemInfo } from '../shared';
import { getPlanPrompt } from './prompt';
import { getPlanToolInstructions } from './tools';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface PlanPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
}

/**
 * Build the complete Plan mode system prompt
 */
export function buildPlanPrompt(options: PlanPromptOptions): string {
    const { workspace, enabledTools } = options;

    // Tool format section (generic XML format)
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Mode-specific tool instructions (Plan-specific, no editing tool mentions)
    const toolInstructions = getPlanToolInstructions(enabledTools);

    // Monolithic prompt (cognitive workflow + rules + mode description)
    const prompt = getPlanPrompt(workspace);

    const userRules = getUserRules(workspace);
    const systemInfo = getSystemInfo(workspace);

    // Assemble in priority order
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
export { getPlanToolInstructions } from './tools';