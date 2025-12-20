import { Loader, Folder, Search, FileSearch, Trash2, Radar, XCircle, Stethoscope, Cable, ClipboardList, type LucideIcon } from 'lucide-react';
import type { IconType } from 'react-icons';
import { getToolMetadata } from '../lib/tool-registry';
import { getFileIconConfig, extractFileName } from './file-icon-mapper';

export interface ToolFileInfo {
  displayName: string;
  fullPath: string;
  icon: LucideIcon | IconType;
  iconColor: string;
  isSpinning: boolean;
}

/**
 * Get file info and icon configuration for a tool
 */
export function getToolFileInfo(
  toolName: string,
  parameters: Record<string, unknown>,
  status: string,
  isStreaming: boolean
): ToolFileInfo {
  // For read_file, check both 'path' (single) and 'paths' (array) parameters
  let path = parameters.path as string | undefined;
  if (toolName === 'read_file' && !path) {
    const paths = parameters.paths as string[] | undefined;
    if (paths && Array.isArray(paths) && paths.length > 0) {
      path = paths[0]; // Use first path for display
    }
  }
  const isExecuting = isStreaming || status === 'pending' || status === 'executing';
  const isAborted = status === 'aborted';

  // Helper to get icon based on state
  const getIcon = (defaultIcon: LucideIcon | IconType) => {
    if (isAborted) return XCircle;
    if (isExecuting) return Loader;
    return defaultIcon;
  };

  // Helper to get icon color based on state
  const getIconColor = (defaultColor: string) => {
    if (isAborted) return 'var(--vscode-errorForeground)';
    if (isExecuting) return 'var(--vscode-charts-blue)';
    return defaultColor;
  };

  // For write_to_file and read_file, ALWAYS prioritize showing filename
  if ((toolName === 'write_to_file' || toolName === 'read_file') && path) {
    const fileName = extractFileName(path);
    const iconConfig = getFileIconConfig(path);

    return {
      displayName: fileName,
      fullPath: path,
      icon: getIcon(iconConfig.icon),
      iconColor: getIconColor(iconConfig.color),
      isSpinning: isExecuting,
    };
  }

  // List files -> Use Folder icon
  if (toolName === 'list_files') {
    const displayPath = !path || path === '' ? 'root' : String(path);
    return {
      displayName: displayPath,
      fullPath: path || '',
      icon: getIcon(Folder),
      iconColor: getIconColor('var(--vscode-charts-blue)'),
      isSpinning: isExecuting,
    };
  }

  // Grep search -> Use Search icon
  if (toolName === 'grep_search') {
    const query = parameters.query as string;
    const truncatedQuery = query && query.length > 60 ? query.substring(0, 60) + '...' : query;
    return {
      displayName: truncatedQuery ? `Search: ${truncatedQuery}` : 'Search',
      fullPath: path || '',
      icon: getIcon(Search),
      iconColor: getIconColor('var(--vscode-editor-foreground)'),
      isSpinning: isExecuting,
    };
  }

  // Echo search -> Use Radar icon and query text as display name
  if (toolName === 'echo_search') {
    const query = parameters.query as string | undefined;
    const truncatedQuery = query && query.length > 100 ? query.substring(0, 100) + '...' : query;
    const displayName = truncatedQuery || 'Echo Search';

    return {
      displayName,
      fullPath: path || '',
      icon: getIcon(Radar),
      iconColor: getIconColor('var(--vscode-editor-foreground)'),
      isSpinning: isExecuting,
    };
  }

  // Glob search -> Use FileSearch icon
  if (toolName === 'glob_search') {
    const pattern = parameters.pattern as string | string[];
    const patternDisplay = Array.isArray(pattern)
      ? pattern.length === 1
        ? pattern[0]
        : `${pattern.length} patterns`
      : pattern;
    const truncatedPattern = patternDisplay && patternDisplay.length > 60 
      ? patternDisplay.substring(0, 60) + '...' 
      : patternDisplay;
    return {
      displayName: truncatedPattern || 'Glob Search',
      fullPath: path || '',
      icon: getIcon(FileSearch),
      iconColor: getIconColor('var(--vscode-editor-foreground)'),
      isSpinning: isExecuting,
    };
  }

  // Get diagnostics -> Use Stethoscope icon
  if (toolName === 'get_diagnostics') {
    const targetPath = path || (parameters.file_pattern as string) || 'workspace';
    return {
      displayName: `${targetPath}`,
      fullPath: path || '',
      icon: getIcon(Stethoscope),
      iconColor: getIconColor('var(--vscode-editorWarning-foreground)'),
      isSpinning: isExecuting,
    };
  }

  // Delete file -> Use Trash icon
  if (toolName === 'delete_file') {
    const fileName = path ? extractFileName(path) : 'file';
    return {
      displayName: fileName,
      fullPath: path || '',
      icon: getIcon(Trash2),
      iconColor: getIconColor('var(--vscode-errorForeground)'),
      isSpinning: isExecuting,
    };
  }

  // Plan tool -> Use ClipboardList icon with "Plan" display name
  if (toolName === 'plan') {
    return {
      displayName: 'Plan',
      fullPath: '',
      icon: getIcon(ClipboardList),
      iconColor: getIconColor('var(--vscode-foreground)'),
      isSpinning: isExecuting,
    };
  }

  // Generic file operations with path
  if (path) {
    const fileName = extractFileName(path);
    const iconConfig = getFileIconConfig(path);
    return {
      displayName: fileName,
      fullPath: path,
      icon: getIcon(iconConfig.icon),
      iconColor: getIconColor(iconConfig.color),
      isSpinning: isExecuting,
    };
  }

  // MCP tools -> Use Cable icon
  if (toolName.startsWith('mcp_')) {
    // Remove 'mcp_' prefix for display name
    const displayName = toolName.substring(4);
    return {
      displayName,
      fullPath: '',
      icon: getIcon(Cable),
      iconColor: getIconColor('var(--vscode-charts-purple)'),
      isSpinning: isExecuting,
    };
  }

  // Fallback
  const metadata = getToolMetadata(toolName);
  return {
    displayName: metadata?.name || toolName,
    fullPath: '',
    icon: getIcon(metadata?.icon || getFileIconConfig('').icon),
    iconColor: getIconColor('var(--vscode-editor-foreground)'),
    isSpinning: isExecuting,
  };
}
