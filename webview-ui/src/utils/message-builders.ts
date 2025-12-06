/**
 * Build a refactor request message
 * @param filename - The filename to refactor
 * @returns Formatted refactor message
 */
export const buildRefactorMessage = (filename: string): string =>
  `Refactor @${filename} into smaller, focused modules following SOLID principles. Preserve all existing functionality and features.`;