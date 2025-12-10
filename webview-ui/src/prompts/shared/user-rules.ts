/**
 * User-defined rules from AGENTS.md and custom system prompts
 * These have highest priority and override other rules if conflicting
 */

import type { WorkspaceContext } from '../../types/workspace';
import { storageService } from '../../utils/storage';

/**
 * Get user-specific rules section (AGENTS.md + custom instructions)
 * These are placed last in the prompt for highest priority
 */
export function getUserRules(workspace: WorkspaceContext | null): string {
    const customSystemPrompt = storageService.getSystemPrompt();
    const agentsConfig = workspace?.agentsConfig;

    const workspaceLevelRules = agentsConfig && agentsConfig.trim().length > 0
        ? `====

WORKSPACE-LEVEL RULES (FROM AGENTS.md - HIGHEST PRIORITY)

These rules are loaded from the AGENTS.md file at the root of the current workspace.

CRITICAL: If any instruction in this section conflicts with other rules in this prompt, you MUST follow this section.

${agentsConfig}`
        : '';

    const userLevelRules = customSystemPrompt && customSystemPrompt.trim().length > 0
        ? `====

USER-LEVEL CUSTOM INSTRUCTIONS (HIGHEST PRIORITY)

These rules come from the user's custom instructions/settings.

CRITICAL: If any instruction in this section conflicts with other rules in this prompt, you MUST follow this section.

${customSystemPrompt}`
        : '';

    if (!workspaceLevelRules && !userLevelRules) {
        return '';
    }

    return `${workspaceLevelRules}${workspaceLevelRules && userLevelRules ? '\n\n' : ''}${userLevelRules}`;
}
