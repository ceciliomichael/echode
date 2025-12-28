/**
 * Plan Mode - Main Prompt
 * 
 * Debloated, focused, and precise.
 * Core principle: Stay in scope. Be complete. Don't be lazy.
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { IMAGE_AWARENESS_RULES, getIsolationRules } from '../shared';
import { YOLO_INTERACTION_RULES, STANDARD_INTERACTION_RULES } from './constants';
import {
    PLAN_IDENTITY_STANDARD,
    PLAN_IDENTITY_YOLO,
    PLAN_WORKFLOW,
    PLAN_SCOPE_RULES
} from './sections';

export interface PlanPromptConfig {
    workspace: WorkspaceContext | null;
    enabledTools?: Tool[];
    isYoloMode?: boolean;
}

export function getPlanPrompt(config: PlanPromptConfig): string;
export function getPlanPrompt(workspace: WorkspaceContext | null, enabledTools?: Tool[]): string;
export function getPlanPrompt(
    workspaceOrConfig: WorkspaceContext | null | PlanPromptConfig,
    enabledTools: Tool[] = []
): string {
    let workspace: WorkspaceContext | null;
    let tools: Tool[];
    let isYoloMode: boolean;

    if (workspaceOrConfig && typeof workspaceOrConfig === 'object' && 'workspace' in workspaceOrConfig) {
        workspace = workspaceOrConfig.workspace;
        tools = workspaceOrConfig.enabledTools ?? [];
        isYoloMode = workspaceOrConfig.isYoloMode ?? false;
    } else {
        workspace = workspaceOrConfig;
        tools = enabledTools;
        isYoloMode = false;
    }

    const cwd = workspace?.path || 'the current workspace directory';
    const toolList = tools.map(t => t.id).join(', ');

    // Mode-specific selections
    const identity = isYoloMode ? PLAN_IDENTITY_YOLO : PLAN_IDENTITY_STANDARD;
    const interactionRules = isYoloMode ? YOLO_INTERACTION_RULES : STANDARD_INTERACTION_RULES;

    return `<plan_mode>
${identity}

<context>
Workspace: ${cwd}
Tools: ${toolList}
</context>

${getIsolationRules('context')}

${interactionRules}

${PLAN_WORKFLOW}

${PLAN_SCOPE_RULES}

${IMAGE_AWARENESS_RULES}
</plan_mode>`;
}