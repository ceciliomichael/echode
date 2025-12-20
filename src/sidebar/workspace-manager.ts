import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { getWorkspaceFiles, getAgentsConfig } from '../utils/workspace-scanner';
import { getAllWorkspaceFolders } from '../services/tools/utils/workspace-utils';

/**
 * Workspace Manager
 * Handles workspace monitoring, file watching, and refactor scanning
 */
export class WorkspaceManager {
  private _fileWatchers: vscode.FileSystemWatcher[] = [];
  private _workspaceUpdateDebounce?: NodeJS.Timeout;
  private _refactorScanInProgress: boolean = false;
  private _refactorScanComplete: boolean = false;
  private _cachedLargeFiles: { path: string; lineCount: number }[] = [];

  constructor(private readonly _extensionPath: string) {
    this.setupFileWatcher();
  }

  /**
   * Get current workspace path
   */
  public getCurrentWorkspacePath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : undefined;
  }

  /**
   * Setup file system watcher to detect file changes in workspace
   */
  public setupFileWatcher(onUpdate?: () => void): void {
    // Dispose existing watchers if any
    this._fileWatchers.forEach(w => w.dispose());
    this._fileWatchers = [];

    const workspaceFolders = getAllWorkspaceFolders();
    if (workspaceFolders.length === 0) {
      return;
    }

    // Debounced update to avoid excessive refreshes
    const debouncedUpdate = () => {
      if (this._workspaceUpdateDebounce) {
        clearTimeout(this._workspaceUpdateDebounce);
      }
      this._workspaceUpdateDebounce = setTimeout(() => {
        this._refactorScanComplete = false;
        this._cachedLargeFiles = [];
        onUpdate?.();
      }, 300);
    };

    // Watch for all file changes in all workspaces
    for (const folder of workspaceFolders) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, '**/*')
      );

      // Listen for file create, delete, and rename events
      watcher.onDidCreate(debouncedUpdate);
      watcher.onDidDelete(debouncedUpdate);
      
      this._fileWatchers.push(watcher);
    }
  }

  /**
   * Reset refactor scan state (called when files are modified via tools)
   */
  public resetRefactorScan(): void {
    this._refactorScanComplete = false;
    this._cachedLargeFiles = [];
  }

  /**
   * Send current workspace info to webview
   */
  public sendWorkspaceInfo(webview: vscode.Webview): void {
    const workspaceFolders = getAllWorkspaceFolders();
    
    if (workspaceFolders.length === 0) {
      webview.postMessage({
        type: 'workspaceInfo',
        workspace: null
      });
      return;
    }

    // Aggregate files from all workspaces
    const allFiles: string[] = [];
    const isMultiRoot = workspaceFolders.length > 1;

    for (const folder of workspaceFolders) {
      try {
        const files = getWorkspaceFiles(folder.uri.fsPath);
        if (isMultiRoot) {
          files.forEach(f => allFiles.push(`${folder.name}/${f}`));
        } else {
          allFiles.push(...files);
        }
      } catch (error) {
        console.error(`[Echode] Failed to scan files for workspace ${folder.name}:`, error);
      }
    }

    // Build workspace info with multi-root support
    const workspaceInfo = {
      path: workspaceFolders[0].uri.fsPath,
      name: workspaceFolders[0].name,
      files: allFiles,
      agentsConfig: getAgentsConfig(workspaceFolders[0].uri.fsPath),
      isMultiRoot,
      folders: isMultiRoot
        ? workspaceFolders.map(folder => ({
            name: folder.name,
            path: folder.uri.fsPath
          }))
        : undefined
    };

    webview.postMessage({
      type: 'workspaceInfo',
      workspace: workspaceInfo
    });

    // Also send refactor scan results
    this.sendRefactorScanResults(webview);
  }

  /**
   * Send refactor scan results (large files) to webview
   * Spawns external Node process for each workspace and aggregates results
   */
  public sendRefactorScanResults(webview: vscode.Webview): void {
    // If scan already completed, send cached results
    if (this._refactorScanComplete) {
      webview.postMessage({
        type: 'refactorScanResults',
        largeFiles: this._cachedLargeFiles
      });
      return;
    }

    // Skip if scan already in progress
    if (this._refactorScanInProgress) {
      return;
    }
    this._refactorScanInProgress = true;

    const workspaceFolders = getAllWorkspaceFolders();

    if (workspaceFolders.length === 0) {
      this._refactorScanInProgress = false;
      this._refactorScanComplete = true;
      webview.postMessage({
        type: 'refactorScanResults',
        largeFiles: []
      });
      return;
    }

    const scriptPath = path.join(this._extensionPath, 'dist', 'scripts', 'scan-large-files.js');
    console.log('[Echode] Spawning scan scripts for workspaces');
    const startTime = Date.now();

    // Helper to scan a single workspace
    const scanWorkspace = (folder: vscode.WorkspaceFolder): Promise<{ path: string; lineCount: number }[]> => {
      return new Promise((resolve) => {
        const workspacePath = folder.uri.fsPath;
        const child = spawn('node', [scriptPath, workspacePath, '300'], {
          cwd: workspacePath,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.on('close', (code) => {
          let results: { path: string; lineCount: number }[] = [];
          if (code === 0 && stdout) {
            try {
              results = JSON.parse(stdout);
              // Prefix if multi-root
              if (workspaceFolders.length > 1) {
                results = results.map(r => ({ ...r, path: `${folder.name}/${r.path}` }));
              }
            } catch { }
          }
          resolve(results);
        });

        child.on('error', () => resolve([]));
        
        // Timeout for individual scan
        setTimeout(() => {
          if (!child.killed) child.kill();
          resolve([]);
        }, 8000);
      });
    };

    // Run scans in parallel
    Promise.all(workspaceFolders.map(scanWorkspace)).then(results => {
      const elapsed = Date.now() - startTime;
      console.log(`[Echode] All scans completed in ${elapsed}ms`);

      this._refactorScanInProgress = false;
      this._refactorScanComplete = true;

      // Flatten results
      const largeFiles = results.flat();
      this._cachedLargeFiles = largeFiles;

      webview.postMessage({
        type: 'refactorScanResults',
        largeFiles
      });
    });
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this._fileWatchers.forEach(w => w.dispose());
    if (this._workspaceUpdateDebounce) {
      clearTimeout(this._workspaceUpdateDebounce);
    }
  }
}