/**
 * Build a refactor request message
 * @param filePath - The full file path to refactor
 * @returns Formatted refactor message
 */
export const buildRefactorMessage = (filePath: string): string => {
  const fileName = filePath.split('/').pop() || filePath;
  return `I need help refactoring the file located at: ${filePath}

This file appears to be quite large and could benefit from being split into smaller, more focused modules.

Please:
1. Analyze the file structure and identify logical boundaries
2. Create a refactoring plan that breaks it down following SOLID principles
3. Ensure all existing functionality and features are preserved
4. Suggest clear module/file names for the new structure

File to refactor: ${fileName}
Full path: ${filePath}`;
};