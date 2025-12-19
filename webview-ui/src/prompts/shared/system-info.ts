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

    let fileSection = '';

    // Check if files are prefixed with workspace names (multi-root)
    // We assume multi-root if we can group files by a top-level directory that matches the workspace naming convention
    // However, WorkspaceManager guarantees prefixes in multi-root.
    // We'll group by the first path segment.
    
    const groups = new Map<string, string[]>();
    const files = workspace.files;
    let isMultiRoot = false;

    if (files.length > 0) {
        // heuristic: check if we have multiple top-level folders
        for (const file of files) {
            const parts = file.split('/');
            const root = parts[0];
            if (!groups.has(root)) {
                groups.set(root, []);
            }
            groups.get(root)!.push(file);
        }

        // If we have distinct groups and they look like workspace roots, format accordingly
        if (groups.size > 1) {
            isMultiRoot = true;
            const sections: string[] = [];
            
            // Sort groups by name
            const sortedKeys = Array.from(groups.keys()).sort();
            
            for (const key of sortedKeys) {
                const groupFiles = groups.get(key)!.sort();
                // We display the FULL path (including prefix) to avoid ambiguity,
                // but wrapped in the workspace tag for visual grouping.
                sections.push(`<${key}>\n${groupFiles.join('\n')}\n</${key}>`);
            }
            
            fileSection = sections.join('\n\n');
        } else {
            // Single root or single group
            fileSection = `<files>\n${files.join('\n')}\n</files>`;
        }
    } else {
        fileSection = `<files>\nNo files found.\n</files>`;
    }

    // Adjust note based on structure
    const note = isMultiRoot
        ? `The file list above is grouped by project. To access a file, USE THE FULL PATH shown (e.g., "ProjectName/src/file.ts").`
        : `The file list above is a complete snapshot. Do not assume other files exist. Use list_files or glob_search to find files.`;

    return `<system_info>
<os>Windows</os>
<workspace_name>${workspace.name}</workspace_name>
<workspace_path>${workspace.path}</workspace_path>
${fileSection}
<note>${note}</note>
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
