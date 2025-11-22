import { Loader, Folder, Search, Trash2, type LucideIcon } from 'lucide-react';
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
  const path = parameters.path as string | undefined;
  const isExecuting = isStreaming || status === 'pending' || status === 'executing';

  // For write_to_file and read_file, ALWAYS prioritize showing filename
  if ((toolName === 'write_to_file' || toolName === 'read_file') && path) {
    const fileName = extractFileName(path);
    const iconConfig = getFileIconConfig(path);

    return {
      displayName: fileName,
      fullPath: path,
      icon: isExecuting ? Loader : iconConfig.icon,
      iconColor: isExecuting ? 'var(--vscode-charts-blue)' : iconConfig.color,
      isSpinning: isExecuting,
    };
  }

  // List files -> Use Folder icon
  if (toolName === 'list_files') {
    const displayPath = !path || path === '' ? 'root' : String(path);
    return {
      displayName: displayPath,
      fullPath: path || '',
      icon: isExecuting ? Loader : Folder,
      iconColor: 'var(--vscode-charts-blue)',
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
      icon: isExecuting ? Loader : Search,
      iconColor: isExecuting
        ? 'var(--vscode-charts-blue)'
        : 'var(--vscode-editor-foreground)',
      isSpinning: isExecuting,
    };
  }

  // Delete file -> Use Trash icon
  if (toolName === 'delete_file') {
    const fileName = path ? extractFileName(path) : 'file';
    return {
      displayName: fileName,
      fullPath: path || '',
      icon: isExecuting ? Loader : Trash2,
      iconColor: isExecuting ? 'var(--vscode-charts-blue)' : 'var(--vscode-errorForeground)',
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
      icon: isExecuting ? Loader : iconConfig.icon,
      iconColor: isExecuting ? 'var(--vscode-charts-blue)' : iconConfig.color,
      isSpinning: isExecuting,
    };
  }

  // Fallback
  const metadata = getToolMetadata(toolName);
  return {
    displayName: metadata?.name || toolName,
    fullPath: '',
    icon: isExecuting ? Loader : (metadata?.icon || getFileIconConfig('').icon),
    iconColor: isExecuting ? 'var(--vscode-charts-blue)' : 'var(--vscode-editor-foreground)',
    isSpinning: isExecuting,
  };
}
