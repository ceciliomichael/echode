import { memo, useMemo } from 'react';

interface DiffViewerProps {
  oldContent: string | null | undefined;
  newContent: string;
  fileName: string;
  isStreaming?: boolean;
  viewOnly?: boolean;
  startLineNumber?: number;
  endLineNumber?: number;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  lineNumber: number | null;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Simple diff algorithm to compare two strings line by line
 */
function computeDiff(oldContent: string | null | undefined, newContent: string, isStreaming: boolean = false, startLineNumber: number = 1): DiffLine[] {
  // If no old content, all lines are added
  if (oldContent === null || oldContent === undefined) {
    const newLines = newContent.split('\n');
    return newLines.map((line, idx) => ({
      type: 'added' as const,
      lineNumber: idx + startLineNumber,
      newLineNumber: idx + startLineNumber,
      oldLineNumber: undefined,
      content: line,
    }));
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: DiffLine[] = [];

  let oldIndex = 0;
  let newIndex = 0;

  // Simple line-by-line comparison
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];

    if (oldIndex >= oldLines.length) {
      // Remaining lines are added
      diff.push({
        type: 'added',
        lineNumber: newIndex + 1,
        newLineNumber: newIndex + 1,
        oldLineNumber: undefined,
        content: newLine,
      });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Remaining lines are removed
      // CRITICAL CHANGE: If streaming, do NOT show remaining lines as removed
      // This prevents the "red wall" effect while generating code
      if (!isStreaming) {
        diff.push({
          type: 'removed',
          lineNumber: oldIndex + 1,
          oldLineNumber: oldIndex + 1,
          newLineNumber: undefined,
          content: oldLine,
        });
      }
      oldIndex++;
    } else if (oldLine === newLine) {
      // Lines are the same
      diff.push({
        type: 'unchanged',
        lineNumber: oldIndex + 1,
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
        content: oldLine,
      });
      oldIndex++;
      newIndex++;
    } else {
      // Check if the new line exists further down in old content
      const foundInOld = oldLines.slice(oldIndex + 1).indexOf(newLine);
      // Check if the old line exists further down in new content
      const foundInNew = newLines.slice(newIndex + 1).indexOf(oldLine);

      if (foundInOld !== -1 && (foundInNew === -1 || foundInOld <= foundInNew)) {
        // Lines were removed
        diff.push({
          type: 'removed',
          lineNumber: oldIndex + 1,
          oldLineNumber: oldIndex + 1,
          newLineNumber: undefined,
          content: oldLine,
        });
        oldIndex++;
      } else if (foundInNew !== -1) {
        // Lines were added
        diff.push({
          type: 'added',
          lineNumber: newIndex + 1,
          newLineNumber: newIndex + 1,
          oldLineNumber: undefined,
          content: newLine,
        });
        newIndex++;
      } else {
        // Lines were changed (show as removed + added)
        diff.push({
          type: 'removed',
          lineNumber: oldIndex + 1,
          oldLineNumber: oldIndex + 1,
          newLineNumber: undefined,
          content: oldLine,
        });
        diff.push({
          type: 'added',
          lineNumber: newIndex + 1,
          newLineNumber: newIndex + 1,
          oldLineNumber: undefined,
          content: newLine,
        });
        oldIndex++;
        newIndex++;
      }
    }
  }

  return diff;
}

const DiffViewerComponent = ({ oldContent, newContent, fileName, isStreaming = false, viewOnly = false, startLineNumber = 1, endLineNumber }: DiffViewerProps) => {
  const diffLines = useMemo(
    () => computeDiff(oldContent, newContent, isStreaming, startLineNumber),
    [oldContent, newContent, isStreaming, startLineNumber],
  );

  // Count additions and deletions
  const additions = diffLines.filter((line) => line.type === 'added').length;
  const deletions = diffLines.filter((line) => line.type === 'removed').length;

  return (
    <div className="w-full">
      {/* Diff Header */}
      <div
        className="flex items-center justify-between px-3 py-2 text-xs font-medium border-b"
        style={{
          backgroundColor: 'var(--vscode-editor-background)',
          borderColor: 'var(--vscode-input-border)',
          color: 'var(--vscode-descriptionForeground)',
        }}
      >
        <span>{fileName}</span>
        {viewOnly && startLineNumber && endLineNumber ? (
          <span>{startLineNumber}-{endLineNumber}</span>
        ) : !viewOnly ? (
          <span className="flex gap-2">
            {additions > 0 && (
              <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>
                +{additions}
              </span>
            )}
            {deletions > 0 && (
              <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>
                -{deletions}
              </span>
            )}
          </span>
        ) : null}
      </div>

      {/* Diff Content */}
      <div
        className="overflow-x-auto text-xs font-mono"
        style={{
          backgroundColor: 'var(--vscode-editor-background)',
          maxHeight: '400px',
          overflowY: 'auto',
        }}
      >
        {diffLines.map((line, idx) => {
          let bgColor: string;
          let borderColor: string;
          let linePrefix: string;

          if (viewOnly) {
            bgColor = 'transparent';
            borderColor = 'transparent';
            linePrefix = '';
          } else {
            switch (line.type) {
              case 'added':
                bgColor = 'var(--vscode-diffEditor-insertedTextBackground)';
                borderColor = 'var(--vscode-gitDecoration-addedResourceForeground)';
                linePrefix = '+';
                break;
              case 'removed':
                bgColor = 'var(--vscode-diffEditor-removedTextBackground)';
                borderColor = 'var(--vscode-gitDecoration-deletedResourceForeground)';
                linePrefix = '-';
                break;
              default:
                bgColor = 'transparent';
                borderColor = 'transparent';
                linePrefix = ' ';
            }
          }

          return (
            <div
              key={idx}
              className={`flex items-start ${viewOnly ? '' : 'border-l-2'}`}
              style={{
                backgroundColor: bgColor,
                borderColor: borderColor,
                minWidth: '100%',
                width: 'fit-content',
              }}
            >
              {/* Line Number */}
              <div
                className="flex-shrink-0 px-2 py-1 text-right select-none min-h-[1.15rem] leading-[1.15rem]"
                style={{
                  minWidth: viewOnly ? '40px' : '50px',
                  color: 'var(--vscode-editorLineNumber-foreground)',
                  backgroundColor: 'var(--vscode-editorLineNumber-background)',
                }}
              >
                {!viewOnly ? (
                  <>
                    {line.oldLineNumber !== undefined && (
                      <span className="inline-block w-6">{line.oldLineNumber}</span>
                    )}
                    {line.oldLineNumber === undefined && <span className="inline-block w-6">-</span>}
                    <span className="mx-1">|</span>
                    {line.newLineNumber !== undefined && (
                      <span className="inline-block w-6">{line.newLineNumber}</span>
                    )}
                    {line.newLineNumber === undefined && <span className="inline-block w-6">-</span>}
                  </>
                ) : (
                  <span className="inline-block w-6">{line.newLineNumber}</span>
                )}
              </div>

              {/* Line Content */}
              <pre
                className="flex-1 px-2 py-1 whitespace-pre m-0 min-h-[1.15rem] leading-[1.15rem]"
                style={{ color: 'var(--vscode-editor-foreground)' }}
              >
                {!viewOnly && (
                  <span
                    className="select-none"
                    style={{
                      color:
                        line.type === 'added'
                          ? 'var(--vscode-gitDecoration-addedResourceForeground)'
                          : line.type === 'removed'
                            ? 'var(--vscode-gitDecoration-deletedResourceForeground)'
                            : 'inherit',
                    }}
                  >
                    {linePrefix}{' '}
                  </span>
                )}
                {line.content || ' '}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DiffViewer = memo(DiffViewerComponent);
