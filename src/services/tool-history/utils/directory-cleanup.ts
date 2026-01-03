import * as vscode from 'vscode';

/**
 * System-generated files that are safe to delete during directory cleanup.
 * These files are created automatically by the OS and don't contain user data.
 */
const SAFE_TO_DELETE_SYSTEM_FILES = new Set([
  '.DS_Store',      // macOS directory metadata
  'Thumbs.db',      // Windows thumbnail cache
  'desktop.ini',    // Windows folder settings
]);

/**
 * Clean up empty directories that were created during file operations
 * Deletes directories in reverse order (deepest first) if they are empty
 * or contain only system-generated metadata files
 */
export async function cleanupEmptyDirectories(
  directories: string[],
  workspacePath: string
): Promise<void> {
  console.log(`[ToolHistory] Cleaning up ${directories.length} directories (if empty or system-only)`);

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

      // Check if directory is empty
      if (contents.length === 0) {
        console.log(`[ToolHistory] Deleting empty directory: ${dirPath}`);
        await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
        continue;
      }

      // Check if directory contains only system files that are safe to delete
      const allSystemFiles = contents.every(([name]) => SAFE_TO_DELETE_SYSTEM_FILES.has(name));

      if (allSystemFiles) {
        console.log(`[ToolHistory] Directory contains only system files (${contents.length}), cleaning: ${dirPath}`);
        
        // Delete each system file first
        for (const [name] of contents) {
          try {
            const fileUri = vscode.Uri.joinPath(dirUri, name);
            await vscode.workspace.fs.delete(fileUri, { recursive: false, useTrash: false });
            console.log(`[ToolHistory] Deleted system file: ${name}`);
          } catch (fileError) {
            // If we can't delete a system file (e.g., locked), skip directory deletion
            console.log(`[ToolHistory] Could not delete system file ${name}:`, fileError instanceof Error ? fileError.message : 'Unknown error');
            continue;
          }
        }

        // Now delete the empty directory
        await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
        console.log(`[ToolHistory] Deleted directory after removing system files: ${dirPath}`);
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