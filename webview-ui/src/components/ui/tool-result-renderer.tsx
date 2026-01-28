import type { ReactNode } from 'react';
import { getToolRenderer } from '../../lib/tool-registry';
import { DiffViewer } from './diff-viewer';
import { DiffResultWrapper } from './diff-result-wrapper';
import { McpToolResult } from './tool-block/mcp-tool-result';
import type { WorkspaceContext } from '../../types/workspace';
import { Folder, File } from 'lucide-react';

/**
 * Normalize content by converting escaped sequences to actual characters.
 * We ONLY do this when the content appears to be a single packed line with
 * no real newlines. This preserves intentional "\\n" inside string literals
 * in normal multi-line code and tool output.
 */
function normalizeEscapedSequences(content: string): string {
  if (!content) return content;

  const hasActualNewlines = content.includes('\n');
  const hasEscapedSequences = /\\[ntr]/.test(content);

  if (!hasActualNewlines && hasEscapedSequences) {
    return content
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r');
  }

  return content;
}

/**
 * Strip line numbers from content formatted as "lineNum | content"
 * Used to show clean code in UI while AI sees line numbers
 * Format from read_file: "  1 | content" (with padding spaces)
 */
function stripLineNumbers(content: string): string {
  // First normalize any escaped sequences
  const normalized = normalizeEscapedSequences(content);
  return normalized
    .split('\n')
    .map((line) => {
      // Match line numbers with format: "  123 | content" or "1 | content"
      // The \s* handles variable padding, \d+ matches line number, \s matches single space after pipe
      // CRITICAL: Use \s (single space) not \s+ to preserve indentation in captured content
      const match = line.match(/^\s*\d+\s+\|\s(.*)$/);
      return match ? match[1] : line;
    })
    .join('\n');
}

/**
 * Render tool result based on tool type
 */
export function renderToolResult(
  toolName: string,
  data: unknown,
  fileName: string,
  workspace?: WorkspaceContext | null
): ReactNode {
  // Special handling for read_file - show view-only viewer
  if (toolName === 'read_file' && typeof data === 'object' && data !== null) {
    // Handle multiple files
    if ('files' in data && Array.isArray((data as { files: unknown[] }).files)) {
      const multiResult = data as { files: Array<{ content: string; path: string; startLine?: number; endLine?: number }> };
      return (
        <div className="space-y-4 px-3 py-3 flex-1 min-h-0 overflow-y-auto">
          {multiResult.files.map((file, index) => {
            const cleanContent = stripLineNumbers(file.content);
            return (
              <DiffViewer
                key={index}
                oldContent={undefined}
                newContent={cleanContent}
                fileName={file.path}
                viewOnly={true}
                startLineNumber={file.startLine || 1}
                endLineNumber={file.endLine}
              />
            );
          })}
        </div>
      );
    }

    // Handle single file
    const result = data as { content?: string; startLine?: number; endLine?: number };
    if (result.content !== undefined) {
      // Strip line numbers from content for clean UI display (AI sees them, user doesn't)
      const cleanContent = stripLineNumbers(result.content);

      return (
        <div className="px-3 py-3 flex-1 min-h-0 flex flex-col overflow-hidden">
          <DiffViewer
            oldContent={undefined}
            newContent={cleanContent}
            fileName={fileName}
            viewOnly={true}
            startLineNumber={result.startLine || 1}
            endLineNumber={result.endLine}
          />
        </div>
      );
    }
  }

  // Special handling for write_to_file tool - show diff viewer
  if (toolName === 'write_to_file' && typeof data === 'object' && data !== null) {
    const result = data as {
      path?: string;
      action?: string;
      oldContent?: string | null;
      newContent?: string;
    };

    if (result.newContent !== undefined) {
      return (
        <div className="px-3 py-3 flex-1 min-h-0 flex flex-col overflow-hidden">
          <DiffResultWrapper
            oldContent={result.oldContent ?? null}
            newContent={result.newContent}
            fileName={fileName}
            contextLines={3}
          />
        </div>
      );
    }
  }

  // Special handling for edit tool - show diff viewer
  if (toolName === 'edit' && typeof data === 'object' && data !== null) {
    const result = data as {
      path?: string;
      oldContent?: string | null;
      newContent?: string;
    };

    if (result.newContent !== undefined && result.oldContent !== undefined) {
      return (
        <div className="px-3 py-3 flex-1 min-h-0 flex flex-col overflow-hidden">
          <DiffResultWrapper
            oldContent={result.oldContent ?? null}
            newContent={result.newContent}
            fileName={fileName}
            contextLines={3}
          />
        </div>
      );
    }
  }

  // Special handling for list_files tool - clean relative paths
  if (toolName === 'list_files' && typeof data === 'object' && data !== null) {
    // Helper to relativize path
    const getRelPath = (fullPath: string) => {
      if (!workspace) return fullPath;
      const normalize = (p: string) => p.replace(/\\/g, '/').toLowerCase();
      const normalizedFull = normalize(fullPath);
      
      // Try multi-root folders first
      if (workspace.folders?.length) {
        for (const folder of workspace.folders) {
          const folderPath = normalize(folder.path);
          if (normalizedFull.startsWith(folderPath)) {
            let relative = fullPath.slice(folder.path.length);
            if (relative.startsWith('/') || relative.startsWith('\\')) relative = relative.slice(1);
            return relative || '.';
          }
        }
      }
      // Try primary root
      if (workspace.path) {
        const rootPath = normalize(workspace.path);
        if (normalizedFull.startsWith(rootPath)) {
          let relative = fullPath.slice(workspace.path.length);
          if (relative.startsWith('/') || relative.startsWith('\\')) relative = relative.slice(1);
          return relative || '.';
        }
      }
      return fullPath;
    };

    // Cast data
    const listData = data as { 
      directories?: Array<{ name: string; type: string }>; 
      files?: Array<{ name: string; type: string; size?: number }>;
      truncated?: boolean;
    };

    if (listData.directories || listData.files) {
      const dirs = listData.directories || [];
      const files = listData.files || [];
      
      return (
        <div className="px-3 py-3 text-xs font-mono">
          <div className="space-y-1">
            {dirs.map((dir, i) => (
              <div key={`d-${i}`} className="flex items-center gap-2 text-blue-400">
                <Folder className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{getRelPath(dir.name)}/</span>
              </div>
            ))}
            {files.map((file, i) => (
              <div key={`f-${i}`} className="flex items-center gap-2" style={{ color: 'var(--vscode-editor-foreground)' }}>
                <File className="w-3 h-3 flex-shrink-0 opacity-70" />
                <span className="truncate">{getRelPath(file.name)}</span>
                {file.size !== undefined && (
                  <span className="opacity-50 ml-auto">
                    {file.size > 1024 ? `${(file.size / 1024).toFixed(1)}KB` : `${file.size}B`}
                  </span>
                )}
              </div>
            ))}
            {listData.truncated && (
              <div className="text-yellow-500 italic mt-2">
                ... listing truncated (too many files)
              </div>
            )}
            {dirs.length === 0 && files.length === 0 && (
              <div className="opacity-50 italic">Empty directory</div>
            )}
          </div>
        </div>
      );
    }
  }

  // Special handling for run_terminal tool - show scrollable terminal output
  if (toolName === 'run_terminal' && typeof data === 'string') {
    return (
      <div className="px-3 py-3">
        <div className="space-y-2">
          <div className="text-xs font-semibold opacity-70">
            Terminal Output
          </div>
          <pre
            className="text-xs font-mono whitespace-pre-wrap p-2 rounded"
            style={{
              backgroundColor: 'var(--vscode-textCodeBlock-background)',
              color: 'var(--vscode-editor-foreground)',
              maxHeight: '400px',
              overflowY: 'auto',
              overflowX: 'auto'
            }}
          >
            {data}
          </pre>
        </div>
      </div>
    );
  }

  // Special handling for MCP tools - show formatted result with word wrap
  if (toolName.startsWith('mcp_')) {
    return (
      <div className="px-3 py-3 flex-1 min-h-0 flex flex-col overflow-hidden">
        <McpToolResult toolName={toolName} data={data} />
      </div>
    );
  }

  // Use registered renderer for other tools
  const renderer = getToolRenderer(toolName);
  if (renderer) {
    return <div className="px-3 py-3">{renderer(data) as ReactNode}</div>;
  }

  // Default fallback
  return (
    <div className="px-3 py-3 flex-1 min-h-0 overflow-auto">
      <pre
        className="text-xs font-mono whitespace-pre overflow-x-auto p-2 rounded-xl"
        style={{
          color: 'var(--vscode-input-foreground)',
          backgroundColor: 'var(--vscode-textCodeBlock-background)',
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
