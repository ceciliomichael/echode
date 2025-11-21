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
    aiDescription: `List files and directories in a workspace path. **DEFAULT TOOL for directory paths**.

**Use list_files when:**
1. Path has NO file extension (e.g., \`src/app\`, \`src/routes\`, \`api\`, \`components/ui\`)
2. You don't know if a path is a file or directory
3. You received "Cannot read directory" error from read_file/patch_file
4. User asks to "explore", "show files in", or "list contents of" a path

**After listing:**
- Use read_file on specific FILES from the results (e.g., \`src/app/page.tsx\`)
- NEVER use read_file on the directory path itself

**Example workflow:**
<function_call>
<tool_name>list_files</tool_name>
<path>src/app</path>
</function_call>

Result shows: page.tsx, layout.tsx, etc.

Then read specific file:
<function_call>
<tool_name>read_file</tool_name>
<path>src/app/page.tsx</path>
</function_call>`,
    icon: FolderTree,
    usage: 'List directory contents - DEFAULT for extensionless paths',
    formatExample: '<function_call>\n<tool_name>list_files</tool_name>\n<path>src/app</path>\n</function_call>',
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
        <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
          {/* Header */}
          <div 
            className="px-3 py-2 text-xs font-medium border-b border-[var(--vscode-input-border)] bg-[var(--vscode-sideBar-background)] flex items-center gap-2"
            style={{ color: 'var(--vscode-sideBarTitle-foreground)' }}
          >
            <Folder className="w-3.5 h-3.5 opacity-70" />
            <span>{result.path || 'root'}</span>
            <span className="ml-auto opacity-50 font-normal">
              {directories.length + files.length} items
            </span>
          </div>
          
          {/* Content */}
          <div className="max-h-[300px] overflow-y-auto">
            {isEmpty ? (
              <div className="px-3 py-4 text-xs text-center opacity-50 italic">
                Empty directory
              </div>
            ) : (
              <div className="py-1">
                {/* Directories */}
                {directories.map((dir, index) => (
                  <div
                    key={`dir-${index}`}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
                  >
                    <Folder 
                      className="w-4 h-4 flex-shrink-0" 
                      style={{ color: 'var(--vscode-charts-blue)' }}
                    />
                    <span 
                      className="text-sm font-medium truncate"
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
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
                    >
                      <Icon 
                        className="w-4 h-4 flex-shrink-0" 
                        style={{ color: iconConfig.color }}
                      />
                      <span 
                        className="text-sm truncate flex-1"
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
