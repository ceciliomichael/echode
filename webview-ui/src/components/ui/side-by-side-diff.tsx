import { memo, useMemo, useRef } from 'react';

interface SideBySideDiffProps {
  oldContent: string | null | undefined;
  newContent: string;
  fileName: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  oldContent: string;
  newContent: string;
}

/**
 * Compute side-by-side diff between old and new content
 */
function computeSideBySideDiff(
  oldContent: string | null | undefined,
  newContent: string
): DiffLine[] {
  const newLines = newContent.split('\n');
  
  // If no old content, all lines are added
  if (oldContent === null || oldContent === undefined) {
    return newLines.map((line, idx) => ({
      type: 'added' as const,
      oldLineNumber: null,
      newLineNumber: idx + 1,
      oldContent: '',
      newContent: line,
    }));
  }

  const oldLines = oldContent.split('\n');
  const diff: DiffLine[] = [];

  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];

    if (oldIndex >= oldLines.length) {
      // Remaining lines are added
      diff.push({
        type: 'added',
        oldLineNumber: null,
        newLineNumber: newIndex + 1,
        oldContent: '',
        newContent: newLine,
      });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Remaining lines are removed
      diff.push({
        type: 'removed',
        oldLineNumber: oldIndex + 1,
        newLineNumber: null,
        oldContent: oldLine,
        newContent: '',
      });
      oldIndex++;
    } else if (oldLine === newLine) {
      // Lines are the same
      diff.push({
        type: 'unchanged',
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
        oldContent: oldLine,
        newContent: newLine,
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
          oldLineNumber: oldIndex + 1,
          newLineNumber: null,
          oldContent: oldLine,
          newContent: '',
        });
        oldIndex++;
      } else if (foundInNew !== -1) {
        // Lines were added
        diff.push({
          type: 'added',
          oldLineNumber: null,
          newLineNumber: newIndex + 1,
          oldContent: '',
          newContent: newLine,
        });
        newIndex++;
      } else {
        // Lines were changed - show side by side
        diff.push({
          type: 'removed',
          oldLineNumber: oldIndex + 1,
          newLineNumber: newIndex + 1,
          oldContent: oldLine,
          newContent: newLine,
        });
        oldIndex++;
        newIndex++;
      }
    }
  }

  return diff;
}

/**
 * Side-by-side diff viewer component
 * Shows original content on left, new content on right
 */
function SideBySideDiffComponent({ oldContent, newContent, fileName }: SideBySideDiffProps) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const diffLines = useMemo(
    () => computeSideBySideDiff(oldContent, newContent),
    [oldContent, newContent]
  );

  const isNewFile = oldContent === null || oldContent === undefined;

  // Sync scroll between left and right panels
  const handleScroll = (source: 'left' | 'right') => (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const other = source === 'left' ? rightRef.current : leftRef.current;
    if (other) {
      other.scrollTop = target.scrollTop;
      other.scrollLeft = target.scrollLeft;
    }
  };

  // Count changes for summary
  const addedCount = diffLines.filter(l => l.type === 'added').length;
  const removedCount = diffLines.filter(l => l.type === 'removed').length;

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-[var(--vscode-panel-border)]">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{
          backgroundColor: 'var(--vscode-editor-background)',
          borderColor: 'var(--vscode-panel-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <FileIcon />
          <span 
            className="font-medium text-sm"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {removedCount > 0 && (
            <span className="flex items-center gap-1" style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>
              <span className="font-mono">−{removedCount}</span>
            </span>
          )}
          {addedCount > 0 && (
            <span className="flex items-center gap-1" style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>
              <span className="font-mono">+{addedCount}</span>
            </span>
          )}
        </div>
      </div>

      {/* Column Headers */}
      <div 
        className="flex border-b"
        style={{ borderColor: 'var(--vscode-panel-border)' }}
      >
        <div 
          className="flex-1 px-3 py-1.5 text-xs font-medium"
          style={{
            backgroundColor: 'var(--vscode-diffEditor-removedTextBackground)',
            color: 'var(--vscode-descriptionForeground)',
          }}
        >
          {isNewFile ? 'New File' : 'Original'}
        </div>
        <div 
          className="w-px"
          style={{ backgroundColor: 'var(--vscode-panel-border)' }}
        />
        <div 
          className="flex-1 px-3 py-1.5 text-xs font-medium"
          style={{
            backgroundColor: 'var(--vscode-diffEditor-insertedTextBackground)',
            color: 'var(--vscode-descriptionForeground)',
          }}
        >
          {isNewFile ? 'Content' : 'Modified'}
        </div>
      </div>

      {/* Diff Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Original */}
        <div 
          ref={leftRef}
          className="flex-1 overflow-auto font-mono text-xs"
          style={{ backgroundColor: 'var(--vscode-editor-background)' }}
          onScroll={handleScroll('left')}
        >
          {diffLines.map((line, idx) => (
            <div
              key={`left-${idx}`}
              className="flex min-h-[1.5rem] leading-[1.5rem]"
              style={{
                backgroundColor: line.type === 'removed' 
                  ? 'var(--vscode-diffEditor-removedTextBackground)'
                  : line.type === 'added'
                    ? 'transparent'
                    : 'transparent',
              }}
            >
              {/* Line number */}
              <div 
                className="flex-shrink-0 w-10 px-2 text-right select-none"
                style={{ 
                  color: 'var(--vscode-editorLineNumber-foreground)',
                  backgroundColor: line.type === 'removed' 
                    ? 'var(--vscode-diffEditor-removedLineBackground)'
                    : 'var(--vscode-editor-background)',
                }}
              >
                {line.oldLineNumber ?? ''}
              </div>
              {/* Content */}
              <pre 
                className="flex-1 px-2 whitespace-pre overflow-hidden text-ellipsis m-0"
                style={{ 
                  color: line.type === 'added' 
                    ? 'var(--vscode-editorLineNumber-foreground)' 
                    : 'var(--vscode-editor-foreground)',
                }}
              >
                {line.type === 'added' ? '' : line.oldContent || ' '}
              </pre>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div 
          className="w-px flex-shrink-0"
          style={{ backgroundColor: 'var(--vscode-panel-border)' }}
        />

        {/* Right Panel - Modified */}
        <div 
          ref={rightRef}
          className="flex-1 overflow-auto font-mono text-xs"
          style={{ backgroundColor: 'var(--vscode-editor-background)' }}
          onScroll={handleScroll('right')}
        >
          {diffLines.map((line, idx) => (
            <div
              key={`right-${idx}`}
              className="flex min-h-[1.5rem] leading-[1.5rem]"
              style={{
                backgroundColor: line.type === 'added' 
                  ? 'var(--vscode-diffEditor-insertedTextBackground)'
                  : line.type === 'removed'
                    ? 'transparent'
                    : 'transparent',
              }}
            >
              {/* Line number */}
              <div 
                className="flex-shrink-0 w-10 px-2 text-right select-none"
                style={{ 
                  color: 'var(--vscode-editorLineNumber-foreground)',
                  backgroundColor: line.type === 'added' 
                    ? 'var(--vscode-diffEditor-insertedLineBackground)'
                    : 'var(--vscode-editor-background)',
                }}
              >
                {line.newLineNumber ?? ''}
              </div>
              {/* Content */}
              <pre 
                className="flex-1 px-2 whitespace-pre overflow-hidden text-ellipsis m-0"
                style={{ 
                  color: line.type === 'removed' 
                    ? 'var(--vscode-editorLineNumber-foreground)' 
                    : 'var(--vscode-editor-foreground)',
                }}
              >
                {line.type === 'removed' ? '' : line.newContent || ' '}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * File icon component
 */
function FileIcon() {
  return (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      strokeLinecap="round" 
      strokeLinejoin="round"
      style={{ color: 'var(--vscode-foreground)' }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export const SideBySideDiff = memo(SideBySideDiffComponent);