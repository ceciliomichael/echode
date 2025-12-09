import type { ChatMode } from '../../types/chat-mode';
import type { Tool } from '../../types/tool';

export function getToolChainPatternsSection(mode: ChatMode, enabledTools: Tool[] = []): string {
    // Chat mode has no tools
    if (mode === 'chat') return '';

    const enabledIds = new Set(enabledTools.map(t => t.id));
    const hasEditingTools = enabledIds.has('write_to_file') || enabledIds.has('apply_diff');
    const hasSearchTools = enabledIds.has('echo_search') || enabledIds.has('grep_search');
    const hasReadFile = enabledIds.has('read_file');
    const hasListFiles = enabledIds.has('list_files');
    const hasDiagnostics = enabledIds.has('get_diagnostics');

    const patterns: string[] = [];

    // Exploration pattern
    if (hasSearchTools && hasReadFile) {
        patterns.push(`**EXPLORE**: echo_search (understand) → grep_search (pinpoint) → read_file (full context)`);
    }

    // Edit workflow - CRITICAL pattern
    if (hasEditingTools && hasReadFile) {
        patterns.push(`**EDIT FILE**: read_file (get current state) → apply_diff (targeted change) → verify success`);
    }

    // Create new file
    if (enabledIds.has('write_to_file')) {
        patterns.push(`**NEW FILE**: write_to_file (complete content, creates directories)`);
    }

    // Refactor pattern
    if (hasEditingTools && enabledIds.has('grep_search') && hasReadFile) {
        patterns.push(`**REFACTOR**: grep_search (find all refs) → read_file (each file) → apply_diff (each file)`);
    }

    // Debug pattern
    if (hasDiagnostics && hasReadFile && hasEditingTools) {
        patterns.push(`**FIX ERRORS**: get_diagnostics → read_file (problem files) → apply_diff (fixes)`);
    }

    // Directory exploration
    if (hasListFiles && hasReadFile) {
        patterns.push(`**BROWSE**: list_files (directory) → read_file (specific files)`);
    }

    // Failure recovery pattern
    if (enabledIds.has('apply_diff') && enabledIds.has('write_to_file')) {
        patterns.push(`**DIFF FAILS**: read_file (fresh content) → retry apply_diff → if fails again → write_to_file`);
    }

    if (patterns.length === 0) return '';

    return `<tool_chains>
## COMMON WORKFLOWS

${patterns.map(p => `- ${p}`).join('\n')}

**PARALLEL EXECUTION**: Batch independent calls in one <function_calls> block:
- Multiple grep_search for different patterns → parallel
- Multiple read_file for unrelated files → parallel  
- Sequential dependency (need result first) → separate blocks
</tool_chains>`;
}
