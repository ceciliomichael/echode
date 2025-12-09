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
Explore directory structure. Use for paths WITHOUT extensions.

**DECISION RULE:**
- Path has extension (.ts, .json, etc.) → use read_file
- Path has NO extension → use list_files

**Parameters:**
- path: Directory path (required)
- recursive: List all nested files (optional, default: false)

**INTELLIGENT PATTERNS:**

1. **Verify before read**: Check if path is directory
   \`\`\`
   User mentions "src/app" → list_files first
                           → then read_file on specific files
   \`\`\`

2. **Parallel exploration**:
   \`\`\`xml
   <function_calls>
   <invoke name="list_files"><parameter name="path">src/components</parameter></invoke>
   <invoke name="list_files"><parameter name="path">src/hooks</parameter></invoke>
   <invoke name="list_files"><parameter name="path">src/utils</parameter></invoke>
   </function_calls>
   \`\`\`

3. **Error recovery**:
   - read_file returns "Cannot read directory" → switch to list_files
   - Path not found → verify parent directory first

**WORKFLOW:**
list_files → identify relevant files → read_file on specific files

**WHEN TO USE ALTERNATIVES:**
- Find by pattern → glob_search
- Search content → grep_search
- Understand code → echo_search

**NOTE:** Large directories may be truncated to 200 files`,
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
