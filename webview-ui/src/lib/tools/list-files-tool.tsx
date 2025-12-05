import { FolderTree, Folder } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { getFileIconConfig } from '../../utils/file-icon-mapper';

/**
 * List Files Tool
 */
async function executeListFiles(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('list_files', parameters, signal);
}

// Register list_files tool
registerToolPlugin({
  metadata: {
    id: 'list_files',
    name: 'List Files',
    description: 'List directory contents - USE THIS for paths without extensions',
    aiDescription: `## list_files
Description: Request to list files and directories in a specified workspace path. Use this tool to explore directory structures, discover available files, and understand the organization of the codebase.

Parameters:
- path: (required) The directory path to list (relative to workspace root)
- recursive: (optional) If 'true', list all files under this directory recursively. Defaults to false (top-level only).

Usage:
<function_calls>
<invoke name="list_files">
<parameter name="path">directory/path</parameter>
</invoke>
</function_calls>

Example: Listing contents of src directory
<function_calls>
<invoke name="list_files">
<parameter name="path">src</parameter>
</invoke>
</function_calls>

Example: Listing root directory
<function_calls>
<invoke name="list_files">
<parameter name="path">.</parameter>
</invoke>
</function_calls>

IMPORTANT: When to use list_files:
- Use list_files for paths WITHOUT file extensions (e.g., src/app, api, components/ui)
- Use list_files when you receive "Cannot read directory" error from read_file
- After listing, use read_file on specific FILES from the results (e.g., src/app/page.tsx)
- NEVER use read_file directly on directory paths - always list_files first, then read_file on individual files
- Very large directories may be truncated to the first 200 files for performance`,
    icon: FolderTree,
    usage: 'List directory contents - DEFAULT for extensionless paths',
    formatExample: '<function_calls>\n<invoke name="list_files">\n<parameter name="path">src/app</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeListFiles,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      const result = data as { 
        path: string; 
        directories?: Array<{ name: string; type: 'directory' }>;
        files?: Array<{ name: string; type: 'file'; size?: number }>;
      };
      
      const directories = result.directories || [];
      const files = result.files || [];
      const isEmpty = directories.length === 0 && files.length === 0;

      return (
        <div className="rounded-xl overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
          {/* Content */}
          <div className="max-h-[300px] overflow-y-auto">
            {isEmpty ? (
              <div className="px-3 py-4 text-xs text-center opacity-50 italic">
                Empty directory
              </div>
            ) : (
              <div>
                {/* Directories */}
                {directories.map((dir, index) => (
                  <div
                    key={`dir-${index}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-[var(--vscode-list-hoverBackground)] border-b border-[var(--vscode-input-border)]"
                  >
                    <Folder 
                      className="w-4 h-4 flex-shrink-0" 
                      style={{ color: 'var(--vscode-charts-blue)' }}
                    />
                    <span 
                      className="font-medium truncate"
                      style={{ color: 'var(--vscode-foreground)' }}
                    >
                      {dir.name}
                    </span>
                  </div>
                ))}
                
                {/* Files */}
                {files.map((file, index) => {
                  const iconConfig = getFileIconConfig(file.name);
                  const Icon = iconConfig.icon;
                  
                  return (
                    <div
                      key={`file-${index}`}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-[var(--vscode-list-hoverBackground)] border-b border-[var(--vscode-input-border)] last:border-b-0"
                    >
                      <Icon 
                        className="w-4 h-4 flex-shrink-0" 
                        style={{ color: iconConfig.color }}
                      />
                      <span 
                        className="truncate flex-1"
                        style={{ color: 'var(--vscode-foreground)' }}
                      >
                        {file.name}
                      </span>
                      {file.size !== undefined && (
                        <span 
                          className="text-xs flex-shrink-0 opacity-50"
                          style={{ color: 'var(--vscode-descriptionForeground)' }}
                        >
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }
    return <div className="text-xs opacity-70">Files listed successfully</div>;
  },
});
