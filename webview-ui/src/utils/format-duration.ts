/**
 * Format milliseconds into a human-readable duration string
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(milliseconds / 1000, 0.01);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds.toFixed(2)}s`;
  }
  return `${seconds.toFixed(2)}s`;
}
