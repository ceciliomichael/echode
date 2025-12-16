import { useState } from 'react';
import { DiffViewer } from './diff-viewer';

interface DiffResultWrapperProps {
  oldContent: string | null;
  newContent: string;
  fileName: string;
  contextLines?: number;
  viewOnly?: boolean;
}

const LARGE_DIFF_APPROX_LINE_THRESHOLD = 800;

export function DiffResultWrapper({ oldContent, newContent, fileName, contextLines, viewOnly }: DiffResultWrapperProps) {
  const [showFull, setShowFull] = useState(false);

  const oldLines = oldContent ? oldContent.split('\n').length : 0;
  const newLines = newContent ? newContent.split('\n').length : 0;
  const approximateLines = Math.max(oldLines, newLines);
  const isLarge = approximateLines > LARGE_DIFF_APPROX_LINE_THRESHOLD;

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
        Large diff detected (~{approximateLines} lines). Rendering the full diff may be slow.
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
