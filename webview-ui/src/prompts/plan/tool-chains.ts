/**
 * Plan Mode - Tool chain patterns
 */

import type { Tool } from '../../types/tool';

export function getPlanToolChains(enabledTools: Tool[] = []): string {
    const enabledIds = new Set(enabledTools.map(t => t.id));

    const patterns: string[] = [];

    // Question-first pattern (CRITICAL)
    if (enabledIds.has('plan_navigator') && enabledIds.has('plan_handoff')) {
        patterns.push('CLARIFY FIRST: plan_navigator (any uncertainty) → THEN plan_handoff');
    }

    // Exploration patterns
    if (enabledIds.has('echo_search')) {
        patterns.push('UNDERSTAND: echo_search → semantic code exploration');
    }
    if (enabledIds.has('grep_search') && enabledIds.has('read_file')) {
        patterns.push('PINPOINT: grep_search → read_file (find then verify)');
    }
    if (enabledIds.has('list_files') && enabledIds.has('read_file')) {
        patterns.push('BROWSE: list_files → read_file (structure then content)');
    }

    // Documentation pattern
    if (enabledIds.has('todo_write')) {
        patterns.push('DOCUMENT: Analyze findings → structured plan in chat (primary) → compact task list in todo_write (summary only)');
    }

    if (patterns.length === 0) return '';

    return `<tool_chains>
PLANNING WORKFLOWS:
${patterns.map(p => `- ${p}`).join('\n')}

QUESTION-FIRST RULE:
Any ambiguity or uncertainty? → plan_navigator BEFORE plan_handoff
Never skip straight to plan_handoff if questions remain.

PARALLEL: Multiple read_file/grep_search → batch together
</tool_chains>`;
}
