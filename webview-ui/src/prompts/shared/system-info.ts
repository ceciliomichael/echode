/**
 * System information section
 * Provides workspace context to the AI
 */

import type { WorkspaceContext } from '../../types/workspace';

/**
 * Build workspace metadata section
 * 
 * For multi-root: simulates a virtual "Workspace" folder containing all project folders
 * For single-root: shows the actual workspace name and path
 * 
 * This unified approach lets the AI use relative paths consistently:
 * - Single: src/file.ts (relative to workspace root)
 * - Multi: echode/src/file.ts (relative to virtual Workspace root)
 */
function buildWorkspaceMetadata(workspace: WorkspaceContext): string {
    const isMultiRoot = workspace.isMultiRoot === true;
    
    if (isMultiRoot && workspace.folders && workspace.folders.length > 0) {
        // Virtual "Workspace" root containing project folders
        const folderNames = workspace.folders.map(f => f.name).join(', ');
        return `<workspace_name>Workspace</workspace_name>
<workspace_contents>${folderNames}</workspace_contents>`;
    }
    
    return `<workspace_name>${workspace.name}</workspace_name>
<workspace_path>${workspace.path}</workspace_path>`;
}

/**
 * Build file section - unified flat list format
 * Files are relative paths from workspace root:
 * - Single workspace: src/file.ts
 * - Multi-root: echode/src/file.ts (folder prefix acts as subdirectory)
 */
function buildFileSection(workspace: WorkspaceContext): string {
    const files = workspace.files;
    
    if (files.length === 0) {
        return `No files found.`;
    }
    
    return [...files].sort().join('\n');
}

/**
 * Get current time context for the AI
 * Returns formatted date/time string with timezone
 */
function getTimeContext(): string {
    const now = new Date();
    
    // Format: "Monday, January 15, 2025 at 2:30 PM"
    const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    
    const formatted = now.toLocaleString('en-US', dateOptions);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return `${formatted} (${timezone})`;
}

export interface SystemInfoOptions {
    /** Whether run_terminal is enabled — controls shell type inclusion */
    terminalEnabled?: boolean;
}

/**
 * Get system information section with workspace details
 * Used by modes that need workspace context (agent, plan, ask, general)
 */
export function getSystemInfo(workspace: WorkspaceContext | null, options: SystemInfoOptions = {}): string {
    if (!workspace) {
        return `<system_info>No open workspace.</system_info>`;
    }

    const workspaceMetadata = buildWorkspaceMetadata(workspace);
    const fileSection = buildFileSection(workspace);
    const timeContext = getTimeContext();

    // Only include shell type when run_terminal is enabled
    const shellLine = options.terminalEnabled && workspace.shellType
        ? `\n<shell>${workspace.shellType}</shell>`
        : '';

    // Unified note - paths are always relative (folder prefix in multi-root acts as subdirectory)
    const note = `The file list shows relative paths. Use list_files or glob_search to explore further.`;

    return `<system_info>
<os>Windows</os>${shellLine}
<current_time>${timeContext}</current_time>
${workspaceMetadata}
${fileSection}
<note>${note}</note>
</system_info>`;
}

/**
 * Minimal system info for Chat mode (no file list, no workspace details)
 */
export function getMinimalSystemInfo(): string {
    const timeContext = getTimeContext();
    
    return `====

SYSTEM INFORMATION

Operating System: Windows
Current Time: ${timeContext}
Mode: Conversational (no workspace access)`;
}
