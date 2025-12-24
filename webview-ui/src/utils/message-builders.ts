/**
 * Build a refactor request message
 * @param filePath - The full file path to refactor
 * @returns Formatted refactor message
 */
export const buildRefactorMessage = (filePath: string): string => {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  return `Refactor @[${fileName}](${filePath})

This file is large and needs to be split into smaller, focused modules.

## Before Planning (REQUIRED)
1. **Find all files using this file** - Search for imports/references to this module
2. **Read the file** - Understand the logic and identify logical groupings
3. **Check adjacent files** - Match existing naming/organization patterns

## Requirements
- **Maintain all logic** - Every function must work exactly as before
- **Maintain design** - Follow existing UI/visual patterns and architecture
- Preserve all exports and functionality
- Apply SOLID principles

## Deliverable
A plan showing: files using this → proposed structure → what moves where`;
};