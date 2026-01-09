/**
 * Format milliseconds into a human-readable duration string
 */
export function formatDuration(milliseconds: number): string {
  // Handle very fast completions (< 500ms) gracefully
  if (milliseconds < 500) {
    return '< 1s';
  }

  const totalSeconds = milliseconds / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds.toFixed(2)}s`;
  }
  return `${seconds.toFixed(2)}s`;
}
