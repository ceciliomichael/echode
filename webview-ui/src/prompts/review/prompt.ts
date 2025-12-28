/**
 * Review Mode - Main Prompt
 *
 * Structure:
 * - <identity>: Expert code reviewer
 * - <context>: Workspace and tools
 * - <isolation>: Separation from project content
 * - <philosophy>: Core principles
 * - <severity_context>: Escalation rules
 * - <analysis_checklist>: Categorized issues to look for
 * - <false_positive_handling>: Intentional pattern guidelines
 * - <workflow>: Review process steps
 * - <report_format>: Required output structure
 * - <rules>: Accuracy and quality constraints
 * - <examples>: Good/bad finding examples
 */

import type { WorkspaceContext } from '../../types/workspace';
import type { Tool } from '../../types/tool';
import { IMAGE_AWARENESS_RULES, INTERACTION_RULES, getIsolationRules } from '../shared';
import {
    REVIEW_IDENTITY,
    REVIEW_PHILOSOPHY,
    REVIEW_SEVERITY,
    REVIEW_CHECKLIST,
    REVIEW_FALSE_POSITIVES,
    REVIEW_WORKFLOW,
    REVIEW_REPORT_FORMAT,
    REVIEW_RULES,
    REVIEW_EXAMPLES
} from './sections';

export function getReviewPrompt(workspace: WorkspaceContext | null, enabledTools: Tool[] = []): string {
    const cwd = workspace?.path || 'the current workspace directory';
    const toolList = enabledTools.map(t => t.id).join(', ');

    return `<review_mode>
${REVIEW_IDENTITY}

<context>
Workspace: ${cwd}
Tools: ${toolList}
</context>

${getIsolationRules('context')}

${INTERACTION_RULES}

${REVIEW_PHILOSOPHY}

${REVIEW_SEVERITY}

${REVIEW_CHECKLIST}

${REVIEW_FALSE_POSITIVES}

${REVIEW_WORKFLOW}

${REVIEW_REPORT_FORMAT}

${REVIEW_RULES}

${REVIEW_EXAMPLES}

${IMAGE_AWARENESS_RULES}
</review_mode>`;
}