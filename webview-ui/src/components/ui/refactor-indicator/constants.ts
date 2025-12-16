/**
 * Neutral color for refactor indicator (matches foreground)
 */
export const REFACTOR_COLOR = 'var(--vscode-foreground)';

/**
 * Wave animation keyframes for scanning state
 */
export const WAVE_ANIMATION_KEYFRAMES = `
  @keyframes refactor-wave-shine {
    0% { background-position: 200% 0; }
    100% { background-position: -100% 0; }
  }
`;

/**
 * Format line count for display (e.g., 1500 -> "1.5k")
 */
export function formatLines(lines: number): string {
  if (lines >= 1000) {
    return `${(lines / 1000).toFixed(1)}k`;
  }
  return lines.toString();
}