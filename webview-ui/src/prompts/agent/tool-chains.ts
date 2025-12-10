/**
 * Agent Mode - Tool chain patterns
 */

import type { Tool } from '../../types/tool';

export function getAgentToolChains(enabledTools: Tool[] = []): string {
    const enabledIds = new Set(enabledTools.map(t => t.id));

    const patterns: string[] = [];

    // Search patterns
    if (enabledIds.has('echo_search')) {
        patterns.push('UNDERSTAND: echo_search → get semantic understanding');
    }
    if (enabledIds.has('grep_search') && enabledIds.has('read_file')) {
        patterns.push('FIND & READ: grep_search → read_file (locate then examine)');
    }

    // Critical edit pattern
    if (enabledIds.has('read_file') && enabledIds.has('apply_diff')) {
        patterns.push('EDIT: read_file → COPY content → apply_diff (NEVER skip read)');
    }

    // Fallback pattern
    if (enabledIds.has('apply_diff') && enabledIds.has('write_to_file')) {
        patterns.push('FALLBACK: apply_diff fails twice → write_to_file');
    }

    // Create pattern
    if (enabledIds.has('write_to_file')) {
        patterns.push('CREATE: write_to_file (new files, complete content)');
    }

    // Refactor pattern
    if (enabledIds.has('grep_search') && enabledIds.has('apply_diff')) {
        patterns.push('REFACTOR: grep_search (all refs) → read_file each → apply_diff each');
    }

    // Debug pattern
    if (enabledIds.has('get_diagnostics') && enabledIds.has('apply_diff')) {
        patterns.push('FIX: get_diagnostics → read_file (errors) → apply_diff');
    }

    if (patterns.length === 0) return '';

    return `<tool_chains>
COMMON WORKFLOWS:
${patterns.map(p => `- ${p}`).join('\n')}

PARALLEL: Multiple read_file/grep_search → batch together
SEQUENTIAL: Write operations → one at a time
</tool_chains>`;
}
