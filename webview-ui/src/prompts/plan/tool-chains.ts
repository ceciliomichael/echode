/**
 * Plan Mode - Tool chain patterns for planning workflows
 * Only references tools available in Plan mode
 */

import type { Tool } from '../../types/tool';

export function getPlanToolChains(enabledTools: Tool[] = []): string {
    const enabledIds = new Set(enabledTools.map(t => t.id));

    const patterns: string[] = [];

    // Exploration patterns
    if (enabledIds.has('echo_search') && enabledIds.has('read_file')) {
        patterns.push('EXPLORE: echo_search → read_file (understand, then verify details)');
    }
    if (enabledIds.has('grep_search') && enabledIds.has('read_file')) {
        patterns.push('FIND: grep_search → read_file (locate, then read context)');
    }
    if (enabledIds.has('list_files') && enabledIds.has('read_file')) {
        patterns.push('BROWSE: list_files → read_file (structure, then content)');
    }

    // Planning patterns
    if (enabledIds.has('todo_write')) {
        patterns.push('DOCUMENT: Analyze → todo_write (capture implementation plan after questions resolved)');
    }
    if (enabledIds.has('plan_navigator')) {
        patterns.push('CLARIFY: plan_navigator (ask questions BEFORE finalizing plan - REQUIRED if any uncertainties)');
    }
    if (enabledIds.has('plan_handoff')) {
        patterns.push('COMPLETE: plan_handoff (ONLY after all questions resolved via plan_navigator)');
    }

    if (patterns.length === 0) return '';

    return `<tool_chains>
COMMON WORKFLOWS:
${patterns.map(p => `- ${p}`).join('\n')}

PARALLEL EXECUTION:
- Multiple grep_search for different patterns → parallel
- Multiple read_file for unrelated files → parallel
- Need result first → sequential (separate blocks)
</tool_chains>`;
}
