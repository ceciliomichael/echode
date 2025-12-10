/**
 * Agent Mode - Tool chain patterns for common workflows
 * Only references tools available in Agent mode
 */

import type { Tool } from '../../types/tool';

export function getAgentToolChains(enabledTools: Tool[] = []): string {
    const enabledIds = new Set(enabledTools.map(t => t.id));

    const patterns: string[] = [];

    // Exploration patterns
    if (enabledIds.has('echo_search') && enabledIds.has('read_file')) {
        patterns.push('EXPLORE: echo_search → read_file (understand, then verify)');
    }
    if (enabledIds.has('grep_search') && enabledIds.has('read_file')) {
        patterns.push('FIND: grep_search → read_file (locate, then read)');
    }

    // Edit workflow - CRITICAL
    if (enabledIds.has('read_file') && enabledIds.has('apply_diff')) {
        patterns.push('EDIT: read_file → apply_diff (get current state, then edit)');
    }

    // Create new file
    if (enabledIds.has('write_to_file')) {
        patterns.push('CREATE: write_to_file (complete content, creates directories)');
    }

    // Refactor pattern
    if (enabledIds.has('grep_search') && enabledIds.has('read_file') && enabledIds.has('apply_diff')) {
        patterns.push('REFACTOR: grep_search → read_file each → apply_diff each');
    }

    // Debug pattern
    if (enabledIds.has('get_diagnostics') && enabledIds.has('read_file') && enabledIds.has('apply_diff')) {
        patterns.push('FIX: get_diagnostics → read_file → apply_diff');
    }

    // Fallback pattern
    if (enabledIds.has('apply_diff') && enabledIds.has('write_to_file')) {
        patterns.push('FALLBACK: apply_diff fails twice → write_to_file');
    }

    if (patterns.length === 0) return '';

    return `<tool_chains>
COMMON WORKFLOWS:
${patterns.map(p => `- ${p}`).join('\n')}

PARALLEL EXECUTION:
- Multiple grep_search for different patterns → parallel
- Multiple read_file for unrelated files → parallel
- Write operations → sequential (one at a time)
- Need result first → sequential (separate blocks)
</tool_chains>`;
}
