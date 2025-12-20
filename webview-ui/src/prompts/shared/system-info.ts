/**
 * System information section
 * Provides workspace context to the AI
 */

import type { WorkspaceContext } from '../../types/workspace';

/**
 * Build workspace metadata section based on single/multi-root status
 */
function buildWorkspaceMetadata(workspace: WorkspaceContext): string {
    // Use explicit isMultiRoot flag from backend, with fallback to folders array check
    const isMultiRoot = workspace.isMultiRoot || (workspace.folders && workspace.folders.length > 1);
    
    if (isMultiRoot && workspace.folders && workspace.folders.length > 0) {
        const folderEntries = workspace.folders
            .map(f => `  <folder name="${f.name}" path="${f.path}" />`)
            .join('\n');
        return `<workspace_type>multi-root</workspace_type>
<workspace_folders>
${folderEntries}
</workspace_folders>`;
    }
    
    // Single workspace - use simple name/path format
    return `<workspace_name>${workspace.name}</workspace_name>
<workspace_path>${workspace.path}</workspace_path>`;
}

/**
 * Build file section with proper grouping for multi-root workspaces
 */
function buildFileSection(workspace: WorkspaceContext): { fileSection: string; isMultiRoot: boolean } {
    const files = workspace.files;
    
    if (files.length === 0) {
        return { fileSection: `<files>\nNo files found.\n</files>`, isMultiRoot: false };
    }
    
    // Group files by first path segment
    const groups = new Map<string, string[]>();
    for (const file of files) {
        const parts = file.split('/');
        const root = parts[0];
        if (!groups.has(root)) {
            groups.set(root, []);
        }
        groups.get(root)!.push(file);
    }
    
    // Check if multi-root based on file grouping or explicit flag
    const isMultiRoot = workspace.isMultiRoot || groups.size > 1;
    
    if (isMultiRoot && groups.size > 1) {
        const sections: string[] = [];
        const sortedKeys = Array.from(groups.keys()).sort();
        
        for (const key of sortedKeys) {
            const groupFiles = groups.get(key)!.sort();
            sections.push(`<${key}>\n${groupFiles.join('\n')}\n</${key}>`);
        }
        
        return { fileSection: sections.join('\n\n'), isMultiRoot: true };
    }
    
    return { fileSection: `<files>\n${files.join('\n')}\n</files>`, isMultiRoot: false };
}

/**
 * Get system information section with workspace details
 * Used by modes that need workspace context (agent, plan, ask, general)
 */
export function getSystemInfo(workspace: WorkspaceContext | null): string {
    if (!workspace) {
        return `<system_info>No open workspace.</system_info>`;
    }

    const workspaceMetadata = buildWorkspaceMetadata(workspace);
    const { fileSection, isMultiRoot } = buildFileSection(workspace);

    const note = isMultiRoot
        ? `The file list above is grouped by project. To access a file, USE THE FULL PATH shown (e.g., "ProjectName/src/file.ts").`
        : `The file list above is a complete snapshot. Do not assume other files exist. Use list_files or glob_search to find files.`;

    return `<system_info>
<os>Windows</os>
${workspaceMetadata}
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
