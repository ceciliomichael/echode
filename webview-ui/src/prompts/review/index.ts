/**
 * Review Mode - Main prompt builder
 * Assembles the complete Review mode system prompt for thorough code analysis
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { getUserRules, getSystemInfo } from '../shared';
import { getReviewPrompt } from './prompt';
import { getReviewToolInstructions } from './tools';
import { getToolSystemPrompt } from '../../lib/tool-config';

export interface ReviewPromptOptions {
    workspace: WorkspaceContext | null;
    enabledTools: Tool[];
    model?: string;
}

/**
 * Build the complete Review mode system prompt
 */
export function buildReviewPrompt(options: ReviewPromptOptions): string {
    const { workspace, enabledTools, model } = options;

    // Tool format section (generic XML format)
    const toolsSection = enabledTools.length > 0
        ? getToolSystemPrompt(enabledTools, model)
        : `<tool_status>
No tools are currently enabled.
</tool_status>`;

    // Mode-specific tool instructions (Review-specific, focused on analysis)
    const toolInstructions = getReviewToolInstructions(enabledTools);

    // Main review prompt (analysis checklist, workflow, report format)
    const prompt = getReviewPrompt(workspace, enabledTools);

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
export { getReviewToolInstructions } from './tools';
export { getReviewPrompt } from './prompt';