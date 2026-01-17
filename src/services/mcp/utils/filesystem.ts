/**
 * MCP Filesystem Utilities
 * 
 * Safe file operations for MCP configuration management.
 * Implements atomic writes with backup/rollback support.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

/**
 * Check if a file exists at the given path.
 * 
 * @param filePath - Path to check
 * @returns true if file exists, false otherwise
 */
export async function fileExistsAtPath(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely writes JSON data to a file with atomic write semantics.
 * 
 * Implementation:
 * - Creates parent directories if they don't exist
 * - Writes to a temporary file first
 * - If target exists, backs it up before replacing
 * - Attempts rollback on error
 * - Cleans up temp files on completion
 * 
 * @param filePath - The absolute path to the target file
 * @param data - The data to serialize to JSON and write
 * @returns Promise that resolves when write is complete
 */
export async function safeWriteJson(filePath: string, data: unknown): Promise<void> {
  const absoluteFilePath = path.resolve(filePath);
  const dirPath = path.dirname(absoluteFilePath);

  // Ensure directory structure exists
  try {
    await fs.mkdir(dirPath, { recursive: true });
    await fs.access(dirPath);
  } catch (dirError) {
    console.error(`Failed to create or access directory for ${absoluteFilePath}:`, dirError);
    throw dirError;
  }

  // Generate unique temp file paths
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  const tempNewFilePath = path.join(
    dirPath,
    `.${path.basename(absoluteFilePath)}.new_${timestamp}_${random}.tmp`
  );
  
  let tempBackupFilePath: string | null = null;
  let tempNewCreated = false;
  let backupCreated = false;

  try {
    // Step 1: Write data to a new temporary file
    const jsonContent = JSON.stringify(data, null, 2);
    await fs.writeFile(tempNewFilePath, jsonContent, 'utf-8');
    tempNewCreated = true;

    // Step 2: Check if target file exists. If so, back it up
    const targetExists = await fileExistsAtPath(absoluteFilePath);
    if (targetExists) {
      tempBackupFilePath = path.join(
        dirPath,
        `.${path.basename(absoluteFilePath)}.bak_${timestamp}_${random}.tmp`
      );
      await fs.rename(absoluteFilePath, tempBackupFilePath);
      backupCreated = true;
    }

    // Step 3: Rename the new temp file to the target path (atomic on most systems)
    await fs.rename(tempNewFilePath, absoluteFilePath);
    tempNewCreated = false; // Successfully moved, no longer a temp file

    // Step 4: Clean up backup file if it was created
    if (tempBackupFilePath && backupCreated) {
      try {
        await fs.unlink(tempBackupFilePath);
      } catch (unlinkError) {
        // Log but don't fail - main operation succeeded
        console.error(
          `Successfully wrote ${absoluteFilePath}, but failed to clean up backup ${tempBackupFilePath}:`,
          unlinkError
        );
      }
    }
  } catch (error) {
    console.error(`Operation failed for ${absoluteFilePath}:`, error);

    // Attempt rollback if backup was created
    if (backupCreated && tempBackupFilePath) {
      try {
        await fs.rename(tempBackupFilePath, absoluteFilePath);
        backupCreated = false; // Successfully restored
      } catch (rollbackError) {
        console.error(
          `Failed to restore backup ${tempBackupFilePath} to ${absoluteFilePath}:`,
          rollbackError
        );
      }
    }

    // Clean up the new temp file if it still exists
    if (tempNewCreated) {
      try {
        await fs.unlink(tempNewFilePath);
      } catch (cleanupError) {
        console.error(
          `Failed to clean up temporary new file ${tempNewFilePath}:`,
          cleanupError
        );
      }
    }

    // Clean up the backup file if rollback failed
    if (backupCreated && tempBackupFilePath) {
      try {
        await fs.unlink(tempBackupFilePath);
      } catch (cleanupError) {
        console.error(
          `Failed to clean up temporary backup file ${tempBackupFilePath}:`,
          cleanupError
        );
      }
    }

    throw error;
  }
}

/**
 * Reads and parses a JSON file.
 * 
 * @param filePath - Path to the JSON file
 * @returns Parsed JSON content or null if file doesn't exist or is invalid
 */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Ensures a directory exists, creating it recursively if needed.
 * 
 * @param dirPath - Directory path to ensure exists
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}