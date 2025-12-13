/**
 * System information section
 * Provides workspace context to the AI
 */

import type { WorkspaceContext } from '../../types/workspace';

/**
 * Get system information section with workspace details
 * Used by modes that need workspace context (agent, plan, ask, general)
 */
export function getSystemInfo(workspace: WorkspaceContext | null): string {
    if (!workspace) {
        return `<system_info>No open workspace.</system_info>`;
    }

    const fileList = workspace.files.length > 0
        ? workspace.files.join('\n')
        : 'No files found.';

    return `<system_info>
<os>Windows</os>
<workspace_name>${workspace.name}</workspace_name>
<workspace_path>${workspace.path}</workspace_path>
<files>
${fileList}
</files>
<note>The file list above is a complete snapshot. Do not assume other files exist. Use list_files or glob_search to find files.</note>
</system_info>`;
}

/**
 * Minimal system info for Chat mode (no file list, no workspace details)
 */
export function getMinimalSystemInfo(): string {
    return `====

SYSTEM INFORMATION

Operating System: Windows
Mode: Conversational (no workspace access)`;
}
