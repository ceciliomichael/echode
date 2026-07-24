import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { getWorkspaceFiles, getAgentsConfig } from '../utils/workspace-scanner';
import { getAllWorkspaceFolders } from '../services/tools/utils/workspace-utils';
import { refreshFileExplorer } from '../utils/refresh-file-explorer';

/**
 * Detect the user's default terminal shell type.
 * Checks VS Code's terminal profile settings, then falls back to OS defaults.
 * Returns a human-readable shell name like "PowerShell", "Command Prompt", "Bash", etc.
 */
export function detectShellType(): string {
    const platform = os.platform();
    const terminalConfig = vscode.workspace.getConfiguration('terminal.integrated');

    // Check platform-specific default profile setting
    let profileName: string | undefined;
    if (platform === 'win32') {
        profileName = terminalConfig.get<string>('defaultProfile.windows');
    } else if (platform === 'darwin') {
        profileName = terminalConfig.get<string>('defaultProfile.osx');
    } else {
        profileName = terminalConfig.get<string>('defaultProfile.linux');
    }

    // If a profile name is set, normalize it
    if (profileName) {
        return normalizeShellName(profileName);
    }

    // Fallback: check the SHELL env var (Unix) or COMSPEC (Windows)
    if (platform === 'win32') {
        const comspec = process.env.COMSPEC || '';
        if (comspec.toLowerCase().includes('cmd.exe')) { return 'Command Prompt'; }
        return 'PowerShell';
    } else {
        const shell = process.env.SHELL || '/bin/bash';
        return normalizeShellName(path.basename(shell));
    }
}

/**
 * Normalize a shell profile name or binary name to a clean display name.
 */
function normalizeShellName(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('powershell') || lower === 'pwsh') { return 'PowerShell'; }
    if (lower.includes('cmd') || lower === 'command prompt') { return 'Command Prompt'; }
    if (lower.includes('bash') || lower === 'git bash') { return 'Bash'; }
    if (lower.includes('zsh')) { return 'Zsh'; }
    if (lower.includes('fish')) { return 'Fish'; }
    if (lower.includes('nushell') || lower === 'nu') { return 'Nushell'; }
    if (lower.includes('wsl')) { return 'WSL'; }
    // Return as-is if unrecognized
    return name;
}

/**
 * Workspace Manager
 * Handles workspace monitoring, file watching, and refactor scanning
 */
export class WorkspaceManager {
  private _fileWatchers: vscode.FileSystemWatcher[] = [];
  private _windowStateListener?: vscode.Disposable;
  private _workspaceUpdateDebounce?: NodeJS.Timeout;
  private _onWorkspaceUpdate?: () => void;
  private _pendingRefactorInvalidation: boolean = false;
  private _refactorScanInProgress: boolean = false;
  private _refactorScanComplete: boolean = false;
  private _cachedLargeFiles: { path: string; lineCount: number }[] = [];

  constructor(private readonly _extensionPath: string) {
    // OS watchers can occasionally miss events while the editor is in the
    // background. Reconcile once when the user returns from a native file
    // manager, matching the behavior users expect from VS Code's Explorer.
    this._windowStateListener = vscode.window.onDidChangeWindowState(({ focused }) => {
      if (focused) {
        this.queueWorkspaceUpdate(false);
      }
    });
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
    if (onUpdate) {
      this._onWorkspaceUpdate = onUpdate;
    }

    // Dispose existing watchers if any
    this._fileWatchers.forEach(w => w.dispose());
    this._fileWatchers = [];

    const workspaceFolders = getAllWorkspaceFolders();
    if (workspaceFolders.length === 0) {
      return;
    }

    // Debounce bursts such as folder moves into one tree reconciliation.
    const debouncedUpdate = () => this.queueWorkspaceUpdate(true);

    // Watch for all file changes in all workspaces
    for (const folder of workspaceFolders) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, '**/*')
      );

      // A rename is reported by VS Code as a delete/create pair.
      watcher.onDidCreate(debouncedUpdate);
      watcher.onDidDelete(debouncedUpdate);
      
      this._fileWatchers.push(watcher);
    }
  }

  private queueWorkspaceUpdate(invalidateRefactorScan: boolean): void {
    // Preserve a real file-system invalidation if a focus event joins the same
    // debounce window.
    this._pendingRefactorInvalidation ||= invalidateRefactorScan;

    if (this._workspaceUpdateDebounce) {
      clearTimeout(this._workspaceUpdateDebounce);
    }

    this._workspaceUpdateDebounce = setTimeout(() => {
      this._workspaceUpdateDebounce = undefined;

      if (this._pendingRefactorInvalidation) {
        this.resetRefactorScan();
      }
      this._pendingRefactorInvalidation = false;

      void refreshFileExplorer();
      this._onWorkspaceUpdate?.();
    }, 250);
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
        console.error(`[EchoDE] Failed to scan files for workspace ${folder.name}:`, error);
      }
    }

    // Build workspace info with multi-root support
    const workspaceInfo = {
      path: workspaceFolders[0].uri.fsPath,
      name: workspaceFolders[0].name,
      files: allFiles,
      agentsConfig: getAgentsConfig(workspaceFolders[0].uri.fsPath),
      shellType: detectShellType(),
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
    console.log('[EchoDE] Spawning scan scripts for workspaces');
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
          if (!child.killed) {
            child.kill();
          }
          resolve([]);
        }, 8000);
      });
    };

    // Run scans in parallel
    Promise.all(workspaceFolders.map(scanWorkspace)).then(results => {
      const elapsed = Date.now() - startTime;
      console.log(`[EchoDE] All scans completed in ${elapsed}ms`);

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
    this._fileWatchers = [];
    this._windowStateListener?.dispose();
    this._windowStateListener = undefined;
    if (this._workspaceUpdateDebounce) {
      clearTimeout(this._workspaceUpdateDebounce);
      this._workspaceUpdateDebounce = undefined;
    }
    this._pendingRefactorInvalidation = false;
  }
}
