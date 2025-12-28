/**
 * Ask Mode - Main Prompt
 *
 * Structure:
 * - <identity>: Expert Codebase Analyst
 * - <context>: Workspace and tools
 * - <isolation>: Separation from project content
 * - <communication_style>: Objective and evidence-based
 * - <rules>: Strict accuracy constraints
 * - <workflow>: Mandatory investigation process
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { IMAGE_AWARENESS_RULES, INTERACTION_RULES, getIsolationRules } from '../shared';
import {
    ASK_IDENTITY,
    ASK_STYLE,
    ASK_RULES,
    ASK_WORKFLOW
} from './sections';

export function getAskPrompt(workspace: WorkspaceContext | null, enabledTools: Tool[] = []): string {
    const cwd = workspace?.path || 'the current workspace directory';
    const toolList = enabledTools.map(t => t.id).join(', ');

    return `<ask_mode>
${ASK_IDENTITY}

<context>
Workspace: ${cwd}
Tools: ${toolList}
</context>

${getIsolationRules('context')}

${ASK_STYLE}

${INTERACTION_RULES}

${ASK_WORKFLOW}

${ASK_RULES}

${IMAGE_AWARENESS_RULES}
</ask_mode>`;
}