import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import { getWorkspaceFiles, getAgentsConfig } from '../utils/workspace-scanner';

/**
 * Workspace Manager
 * Handles workspace monitoring, file watching, and refactor scanning
 */
export class WorkspaceManager {
  private _fileWatcher?: vscode.FileSystemWatcher;
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
    // Dispose existing watcher if any
    this._fileWatcher?.dispose();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    // Watch for all file changes in workspace
    this._fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolders[0], '**/*')
    );

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

    // Listen for file create, delete, and rename events
    this._fileWatcher.onDidCreate(debouncedUpdate);
    this._fileWatcher.onDidDelete(debouncedUpdate);
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
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceInfo = workspaceFolders && workspaceFolders.length > 0
      ? {
        path: workspaceFolders[0].uri.fsPath,
        name: workspaceFolders[0].name,
        files: getWorkspaceFiles(workspaceFolders[0].uri.fsPath),
        agentsConfig: getAgentsConfig(workspaceFolders[0].uri.fsPath)
      }
      : null;

    webview.postMessage({
      type: 'workspaceInfo',
      workspace: workspaceInfo
    });

    // Also send refactor scan results
    this.sendRefactorScanResults(webview);
  }

  /**
   * Send refactor scan results (large files) to webview
   * Spawns external Node process to avoid blocking extension host
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

    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      this._refactorScanInProgress = false;
      this._refactorScanComplete = true;
      webview.postMessage({
        type: 'refactorScanResults',
        largeFiles: []
      });
      return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(this._extensionPath, 'dist', 'scripts', 'scan-large-files.js');

    console.log('[Echode] Spawning scan script:', scriptPath);
    const startTime = Date.now();

    // Spawn external Node process
    const child = spawn('node', [scriptPath, workspacePath, '300'], {
      cwd: workspacePath,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Timeout after 10 seconds – only used if scan never completes
    const timeout = setTimeout(() => {
      // If scan already finished, don't override results
      if (this._refactorScanComplete) {
        return;
      }

      this._refactorScanInProgress = false;
      this._refactorScanComplete = true;
      this._cachedLargeFiles = [];

      if (!child.killed) {
        child.kill();
      }

      webview.postMessage({
        type: 'refactorScanResults',
        largeFiles: []
      });
    }, 10000);

    child.on('close', (code) => {
      const elapsed = Date.now() - startTime;
      console.log(`[Echode] Scan completed in ${elapsed}ms, exit code: ${code}`);

      // Scan finished before timeout - prevent timeout handler from firing
      clearTimeout(timeout);

      this._refactorScanInProgress = false;
      this._refactorScanComplete = true;

      let largeFiles: { path: string; lineCount: number }[] = [];

      if (code === 0 && stdout) {
        try {
          largeFiles = JSON.parse(stdout);
          console.log(`[Echode] Found ${largeFiles.length} large files`);
        } catch {
          console.error('[Echode] Failed to parse scan results:', stdout);
        }
      } else if (stderr) {
        console.error('[Echode] Scan script error:', stderr);
      }

      // Cache results for subsequent requests
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
    this._fileWatcher?.dispose();
    if (this._workspaceUpdateDebounce) {
      clearTimeout(this._workspaceUpdateDebounce);
    }
  }
}