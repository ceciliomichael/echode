import { Search, FolderOpen } from 'lucide-react';
import { getFileIconConfig } from '../../../utils/file-icon-mapper';

/**
 * Parse tool call string to extract tool name and parameter
 * e.g., "grep_search(authentication)" -> { tool: 'grep_search', param: 'authentication' }
 * e.g., "read_file_snippet(src/app/page.tsx)" -> { tool: 'read_file_snippet', param: 'src/app/page.tsx' }
 */
export function parseToolCall(toolCall: string): { tool: string; param: string } {
  // Clean up the input - remove leading/trailing whitespace and any arrow prefix
  const cleaned = toolCall.replace(/^[→\s]+/, '').trim();
  
  // Match tool_name(param) - param can be empty or have content including special chars
  const match = cleaned.match(/^(\w+)\((.+)\)$/);
  if (match) {
    const param = match[2].trim();
    return { tool: match[1], param };
  }
  
  // Try matching without requiring content in parentheses
  const emptyMatch = cleaned.match(/^(\w+)\(\)$/);
  if (emptyMatch) {
    return { tool: emptyMatch[1], param: '' };
  }
  
  return { tool: cleaned, param: '' };
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
