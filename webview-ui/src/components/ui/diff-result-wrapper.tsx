import { useState, useMemo } from 'react';
import { DiffViewer } from './diff-viewer';

interface DiffResultWrapperProps {
  oldContent: string | null;
  newContent: string;
  fileName: string;
  contextLines?: number;
  viewOnly?: boolean;
}

/**
 * Threshold for showing the "large diff" warning.
 * Based on actual changed lines, not total file size.
 */
const LARGE_DIFF_CHANGED_LINES_THRESHOLD = 500;

/**
 * Estimate the number of changed lines between old and new content.
 * Uses a simple line-by-line comparison to count additions and removals.
 */
function estimateChangedLines(oldContent: string | null, newContent: string): number {
  // New file: all lines are additions
  if (!oldContent) {
    return newContent.split('\n').length;
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Quick check: if contents are identical, no changes
  if (oldContent === newContent) {
    return 0;
  }

  // Create a Set of old lines for O(1) lookup
  const oldLineSet = new Set(oldLines);
  const newLineSet = new Set(newLines);

  // Count lines that are in new but not in old (additions)
  let changedCount = 0;
  for (const line of newLines) {
    if (!oldLineSet.has(line)) {
      changedCount++;
    }
  }

  // Count lines that are in old but not in new (removals)
  for (const line of oldLines) {
    if (!newLineSet.has(line)) {
      changedCount++;
    }
  }

  return changedCount;
}

export function DiffResultWrapper({ oldContent, newContent, fileName, contextLines, viewOnly }: DiffResultWrapperProps) {
  const [showFull, setShowFull] = useState(false);

  // Calculate changed lines count (memoized to avoid recalculation on re-renders)
  const changedLines = useMemo(
    () => estimateChangedLines(oldContent, newContent),
    [oldContent, newContent]
  );

  const isLarge = changedLines > LARGE_DIFF_CHANGED_LINES_THRESHOLD;

  if (!isLarge || showFull) {
    return (
      <DiffViewer
        oldContent={oldContent}
        newContent={newContent}
        fileName={fileName}
        contextLines={contextLines}
        viewOnly={viewOnly}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-xs"
        style={{ color: 'var(--vscode-descriptionForeground)' }}
      >
        Large diff detected (~{changedLines} changed lines). Rendering the full diff may be slow.
      </div>
      <button
        type="button"
        className="inline-flex items-center justify-center px-2 py-1 text-xs rounded-xl border transition-opacity hover:opacity-80 active:opacity-70"
        style={{
          backgroundColor: 'var(--vscode-button-secondaryBackground)',
          borderColor: 'var(--vscode-input-border)',
          color: 'var(--vscode-button-secondaryForeground)',
        }}
        onClick={() => setShowFull(true)}
      >
        Show full diff
      </button>
    </div>
  );
}
