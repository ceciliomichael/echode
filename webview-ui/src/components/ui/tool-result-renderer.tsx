import type { ReactNode } from 'react';
import { getToolRenderer } from '../../lib/tool-registry';
import { DiffViewer } from './diff-viewer';

/**
 * Strip line numbers from content formatted as "lineNum: content", "lineNum | content", or "lineNum→content"
 * Used to show clean code in UI while AI sees line numbers
 */
function stripLineNumbers(content: string): string {
  return content
    .split('\n')
    .map((line) => {
      // Match "number: ", "number | ", or "number→" at start of line
      const match = line.match(/^\d+(?:→|: | \| )(.*)$/);
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
  fileName: string
): ReactNode {
  // Special handling for read_file - show view-only viewer
  if (toolName === 'read_file' && typeof data === 'object' && data !== null) {
    const result = data as { content?: string; startLine?: number; endLine?: number };
    if (result.content !== undefined) {
      // Strip line numbers from content for clean UI display (AI sees them, user doesn't)
      const cleanContent = stripLineNumbers(result.content);

      return (
        <DiffViewer
          oldContent={undefined}
          newContent={cleanContent}
          fileName={fileName}
          viewOnly={true}
          startLineNumber={result.startLine || 1}
          endLineNumber={result.endLine}
        />
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
        <DiffViewer
          oldContent={result.oldContent ?? null}
          newContent={result.newContent}
          fileName={fileName}
        />
      );
    }
  }

  // Use registered renderer for other tools
  const renderer = getToolRenderer(toolName);
  if (renderer) {
    return <div className="px-3 py-2">{renderer(data) as ReactNode}</div>;
  }

  // Default fallback
  return (
    <div className="px-3 py-2">
      <pre
        className="text-xs font-mono whitespace-pre overflow-x-auto p-2 rounded"
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
