import * as vscode from 'vscode';

/**
 * Clean up empty directories that were created during file operations
 * Deletes directories in reverse order (deepest first) if they are empty
 */
export async function cleanupEmptyDirectories(
  directories: string[],
  workspacePath: string
): Promise<void> {
  console.log(`[ToolHistory] Cleaning up ${directories.length} directories (if empty)`);

  // Process directories in reverse order (deepest first)
  for (let i = directories.length - 1; i >= 0; i--) {
    const dirPath = directories[i];

    // Safety check: never delete workspace root
    if (dirPath === workspacePath || dirPath.length <= workspacePath.length) {
      console.log(`[ToolHistory] Skipping workspace root: ${dirPath}`);
      continue;
    }

    try {
      const dirUri = vscode.Uri.file(dirPath);
      const contents = await vscode.workspace.fs.readDirectory(dirUri);

      // Only delete if directory is empty
      if (contents.length === 0) {
        console.log(`[ToolHistory] Deleting empty directory: ${dirPath}`);
        await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
      } else {
        console.log(`[ToolHistory] Directory not empty (${contents.length} items), keeping: ${dirPath}`);
      }
    } catch (error) {
      console.log(`[ToolHistory] Could not cleanup directory ${dirPath}:`, error instanceof Error ? error.message : 'Unknown error');
      // Ignore errors - directory might already be deleted or not accessible
      continue;
    }
  }
}