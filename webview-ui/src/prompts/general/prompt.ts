/**
 * General Mode - Main Prompt
 *
 * Structure:
 * - <identity>: Who the assistant is (general AI, not a coding agent)
 * - <context>: Workspace path and available tools
 * - <isolation>: Separation between AI capabilities and project content
 * - <capabilities>: What tasks the assistant handles well
 * - <when_to_redirect>: When to suggest other modes
 * - <communication_style>: How to interact with users
 * - <workflow>: Task execution flow
 * - <rules>: Operational constraints
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { IMAGE_AWARENESS_RULES, INTERACTION_RULES, MERMAID_DIAGRAM_RULES, getIsolationRules } from '../shared';
import {
    GENERAL_IDENTITY,
    GENERAL_CAPABILITIES,
    GENERAL_REDIRECT_RULES,
    GENERAL_COMMUNICATION_STYLE,
    GENERAL_WORKFLOW,
    GENERAL_RULES
} from './sections';

export function getGeneralPrompt(workspace: WorkspaceContext | null, enabledTools: Tool[] = []): string {
    const cwd = workspace?.path || 'the current workspace directory';
    const toolList = enabledTools.map(t => t.id).join(', ') || 'none';

    return `<general_mode>
${GENERAL_IDENTITY}

<context>
Workspace: ${cwd}
Tools: ${toolList}
</context>

${getIsolationRules('context')}

${GENERAL_CAPABILITIES}

${GENERAL_REDIRECT_RULES}

${GENERAL_COMMUNICATION_STYLE}

${INTERACTION_RULES}

${MERMAID_DIAGRAM_RULES}

${GENERAL_WORKFLOW}

${GENERAL_RULES}

${IMAGE_AWARENESS_RULES}
</general_mode>`;
}