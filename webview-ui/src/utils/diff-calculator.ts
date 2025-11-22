/**
 * Calculate diff statistics from old and new content
 */
export function calculateDiffStats(
  oldContent: string | null | undefined,
  newContent: string
): { additions: number; deletions: number } {
  if (oldContent === null || oldContent === undefined) {
    const newLines = newContent.split('\n');
    return { additions: newLines.length, deletions: 0 };
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  let additions = 0;
  let deletions = 0;

  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];

    if (oldIndex >= oldLines.length) {
      additions++;
      newIndex++;
    } else if (newIndex >= newLines.length) {
      deletions++;
      oldIndex++;
    } else if (oldLine === newLine) {
      oldIndex++;
      newIndex++;
    } else {
      const foundInOld = oldLines.slice(oldIndex + 1).indexOf(newLine);
      const foundInNew = newLines.slice(newIndex + 1).indexOf(oldLine);

      if (foundInOld !== -1 && (foundInNew === -1 || foundInOld <= foundInNew)) {
        deletions++;
        oldIndex++;
      } else if (foundInNew !== -1) {
        additions++;
        newIndex++;
      } else {
        deletions++;
        additions++;
        oldIndex++;
        newIndex++;
      }
    }
  }

  return { additions, deletions };
}
