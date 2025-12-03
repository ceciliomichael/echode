import { Search, FolderOpen } from 'lucide-react';
import { getFileIconConfig } from '../../../utils/file-icon-mapper';

/**
 * Parse tool call string to extract tool name and parameter
 * e.g., "grep_search(authentication)" -> { tool: 'grep_search', param: 'authentication' }
 */
export function parseToolCall(toolCall: string): { tool: string; param: string } {
  const match = toolCall.match(/^(\w+)\((.+)\)$/);
  if (match) {
    return { tool: match[1], param: match[2] };
  }
  return { tool: toolCall, param: '' };
}

/**
 * Get icon config for a tool - uses file icon for read_file, search icon for others
 */
export function getToolIconConfig(toolCall: string) {
  const { tool, param } = parseToolCall(toolCall);
  
  if (tool === 'read_file_snippet' || tool === 'read_file') {
    // Use file icon based on the file path
    return getFileIconConfig(param);
  }
  
  // Default icons for search tools
  if (tool === 'grep_search') {
    return { icon: Search, color: 'var(--vscode-symbolIcon-functionForeground)' };
  }
  if (tool === 'glob_search') {
    return { icon: Search, color: 'var(--vscode-symbolIcon-fileForeground)' };
  }
  if (tool === 'list_dir') {
    return { icon: FolderOpen, color: 'var(--vscode-symbolIcon-folderForeground)' };
  }
  
  return { icon: Search, color: 'var(--vscode-descriptionForeground)' };
}
