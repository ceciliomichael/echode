import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { shouldExclude } from '../utils/workspace-scanner';

export interface WorkspaceCheckpoint {
  id: string;
  timestamp: number;
  files: Record<string, string>; // relativePath -> content
}

export class CheckpointService {
  private tempCheckpoint: WorkspaceCheckpoint | null = null;

  /**
   * Capture current workspace state as checkpoint
   */
  async captureCheckpoint(workspacePath: string): Promise<WorkspaceCheckpoint> {
    const files: Record<string, string> = {};
    
    const traverse = (dir: string, relativePath: string = '') => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (shouldExclude(entry.name, entry.isDirectory())) {
            continue;
          }
          
          const fullPath = path.join(dir, entry.name);
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          
          if (entry.isDirectory()) {
            traverse(fullPath, relPath);
          } else {
            try {
              // Read file content (text files only for now)
              const content = fs.readFileSync(fullPath, 'utf8');
              files[relPath] = content;
            } catch (error) {
              // Skip binary files or files that can't be read as text
              console.warn(`[Checkpoint] Skipping file ${relPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`[Checkpoint] Error reading directory ${dir}:`, error);
      }
    };
    
    traverse(workspacePath);
    
    const checkpoint: WorkspaceCheckpoint = {
      id: `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      files
    };
    
    return checkpoint;
  }

  /**
   * Restore workspace to checkpoint state
   */
  async restoreCheckpoint(workspacePath: string, checkpoint: WorkspaceCheckpoint, isTemporary: boolean = false): Promise<void> {
    // If this is a temporary restore (preview), save current state first
    if (isTemporary && !this.tempCheckpoint) {
      this.tempCheckpoint = await this.captureCheckpoint(workspacePath);
    }

    // Get current files in workspace
    const currentFiles = new Set<string>();
    const traverse = (dir: string, relativePath: string = '') => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (shouldExclude(entry.name, entry.isDirectory())) {
            continue;
          }
          
          const fullPath = path.join(dir, entry.name);
          const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          
          if (entry.isDirectory()) {
            traverse(fullPath, relPath);
          } else {
            currentFiles.add(relPath);
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };
    
    traverse(workspacePath);

    // Restore files from checkpoint
    for (const [relativePath, content] of Object.entries(checkpoint.files)) {
      const fullPath = path.join(workspacePath, relativePath);
      
      try {
        // Ensure directory exists
        const dirPath = path.dirname(fullPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // Write file content
        fs.writeFileSync(fullPath, content, 'utf8');
        currentFiles.delete(relativePath);
      } catch (error) {
        console.error(`[Checkpoint] Error restoring file ${relativePath}:`, error);
      }
    }

    // Delete files that don't exist in checkpoint (they were created after)
    for (const relativePath of currentFiles) {
      const fullPath = path.join(workspacePath, relativePath);
      try {
        fs.unlinkSync(fullPath);
        console.log(`[Checkpoint] Deleted file not in checkpoint: ${relativePath}`);
      } catch (error) {
        console.error(`[Checkpoint] Error deleting file ${relativePath}:`, error);
      }
    }

    // Clean up empty directories
    this.cleanupEmptyDirectories(workspacePath);
  }

  /**
   * Undo temporary checkpoint restore (when user cancels revert preview)
   */
  async undoTemporaryRestore(workspacePath: string): Promise<void> {
    if (!this.tempCheckpoint) {
      console.warn('[Checkpoint] No temporary checkpoint to restore');
      return;
    }

    await this.restoreCheckpoint(workspacePath, this.tempCheckpoint, false);
    this.tempCheckpoint = null;
  }

  /**
   * Commit temporary restore (make it permanent)
   */
  commitTemporaryRestore(): void {
    this.tempCheckpoint = null;
  }

  /**
   * Clean up empty directories recursively
   */
  private cleanupEmptyDirectories(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !shouldExclude(entry.name, true)) {
          const fullPath = path.join(dir, entry.name);
          this.cleanupEmptyDirectories(fullPath);
          
          // Try to remove directory if empty
          try {
            if (fs.readdirSync(fullPath).length === 0) {
              fs.rmdirSync(fullPath);
            }
          } catch {
            // Directory not empty or can't be removed
          }
        }
      }
    } catch (error) {
      // Skip if directory can't be read
    }
  }
}
