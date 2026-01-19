/**
 * MCP State Service - Manages runtime state for MCP servers per workspace
 * 
 * Stores transient state like `autoConnect` preferences in a separate file
 * to avoid polluting the user's mcp.json configuration.
 * 
 * State file locations:
 * - Global: ~/.echode/mcp/state.json (user's home folder)
 * - Per-project: {workspace}/.echode/mcp/state.json
 * 
 * The service checks project-level state first, then falls back to global state.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { fileExistsAtPath, safeWriteJson } from './utils/filesystem';

interface MCPServerState {
  autoConnect: boolean;
}

interface MCPStateFile {
  servers: Record<string, MCPServerState>;
}

const DEFAULT_STATE: MCPStateFile = {
  servers: {}
};

// Directory structure: .echode/mcp/
const ECHODE_DIR = '.echode';
const MCP_SUBDIR = 'mcp';
const STATE_FILENAME = 'state.json';

/**
 * Get the global MCP state directory path (~/.echode/mcp/)
 */
function getGlobalMcpDir(): string {
  return path.join(os.homedir(), ECHODE_DIR, MCP_SUBDIR);
}

/**
 * Get the global MCP state file path (~/.echode/mcp/state.json)
 */
function getGlobalStatePath(): string {
  return path.join(getGlobalMcpDir(), STATE_FILENAME);
}

/**
 * Get the current workspace path
 */
function getWorkspacePath(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  return workspaceFolders && workspaceFolders.length > 0
    ? workspaceFolders[0].uri.fsPath
    : undefined;
}

/**
 * Get the project MCP state file path ({workspace}/.echode/mcp/state.json)
 */
function getProjectStatePath(): string | undefined {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    return undefined;
  }
  return path.join(workspacePath, ECHODE_DIR, MCP_SUBDIR, STATE_FILENAME);
}

export class MCPStateService {
  private globalStatePath: string;
  private globalState: MCPStateFile = { servers: {} };
  private projectState: MCPStateFile = { servers: {} };
  private initialized = false;

  constructor() {
    this.globalStatePath = getGlobalStatePath();
  }

  /**
   * Initialize the state service by loading existing state
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.ensureGlobalDirExists();
    await this.loadGlobalState();
    await this.loadProjectState();
    this.initialized = true;
  }

  /**
   * Ensure global ~/.echode/mcp/ directory exists
   */
  private async ensureGlobalDirExists(): Promise<void> {
    const dirPath = path.dirname(this.globalStatePath);
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  /**
   * Ensure project .echode/mcp/ directory exists
   */
  private async ensureProjectDirExists(): Promise<void> {
    const projectStatePath = getProjectStatePath();
    if (!projectStatePath) {
      return;
    }
    
    const dirPath = path.dirname(projectStatePath);
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  /**
   * Load global state from disk (~/.echode/mcp/state.json)
   */
  private async loadGlobalState(): Promise<void> {
    try {
      if (await fileExistsAtPath(this.globalStatePath)) {
        const content = await fs.readFile(this.globalStatePath, 'utf-8');
        const parsed = JSON.parse(content);
        this.globalState = {
          servers: parsed.servers ?? {}
        };
      }
    } catch (error) {
      console.error('Failed to load global MCP state:', error);
      this.globalState = { ...DEFAULT_STATE };
    }
  }

  /**
   * Load project state from disk ({workspace}/.echode/mcp/state.json)
   */
  private async loadProjectState(): Promise<void> {
    const projectStatePath = getProjectStatePath();
    if (!projectStatePath) {
      this.projectState = { ...DEFAULT_STATE };
      return;
    }

    try {
      if (await fileExistsAtPath(projectStatePath)) {
        const content = await fs.readFile(projectStatePath, 'utf-8');
        const parsed = JSON.parse(content);
        this.projectState = {
          servers: parsed.servers ?? {}
        };
      } else {
        this.projectState = { ...DEFAULT_STATE };
      }
    } catch (error) {
      console.error('Failed to load project MCP state:', error);
      this.projectState = { ...DEFAULT_STATE };
    }
  }

  /**
   * Save global state to disk
   */
  private async saveGlobalState(): Promise<void> {
    try {
      await safeWriteJson(this.globalStatePath, this.globalState);
    } catch (error) {
      console.error('Failed to save global MCP state:', error);
    }
  }

  /**
   * Save project state to disk
   */
  private async saveProjectState(): Promise<void> {
    const projectStatePath = getProjectStatePath();
    if (!projectStatePath) {
      return;
    }

    try {
      await this.ensureProjectDirExists();
      await safeWriteJson(projectStatePath, this.projectState);
    } catch (error) {
      console.error('Failed to save project MCP state:', error);
    }
  }

  /**
   * Get autoConnect preference for a server
   * Checks project state first, then falls back to global state
   * Returns undefined if no preference is stored (will use default behavior)
   */
  getAutoConnect(serverName: string): boolean | undefined {
    // Project state takes priority
    const projectAutoConnect = this.projectState.servers[serverName]?.autoConnect;
    if (projectAutoConnect !== undefined) {
      return projectAutoConnect;
    }

    // Fall back to global state
    return this.globalState.servers[serverName]?.autoConnect;
  }

  /**
   * Set autoConnect preference for a server
   * Saves to project state if workspace is open, otherwise to global state
   */
  async setAutoConnect(serverName: string, autoConnect: boolean): Promise<void> {
    const workspacePath = getWorkspacePath();
    
    if (workspacePath) {
      // Save to project state
      if (!this.projectState.servers[serverName]) {
        this.projectState.servers[serverName] = { autoConnect };
      } else {
        this.projectState.servers[serverName].autoConnect = autoConnect;
      }
      await this.saveProjectState();
    } else {
      // Save to global state
      if (!this.globalState.servers[serverName]) {
        this.globalState.servers[serverName] = { autoConnect };
      } else {
        this.globalState.servers[serverName].autoConnect = autoConnect;
      }
      await this.saveGlobalState();
    }
  }

  /**
   * Remove state for a server from both project and global state
   */
  async removeServer(serverName: string): Promise<void> {
    let changed = false;

    if (this.projectState.servers[serverName]) {
      delete this.projectState.servers[serverName];
      await this.saveProjectState();
      changed = true;
    }

    if (this.globalState.servers[serverName]) {
      delete this.globalState.servers[serverName];
      await this.saveGlobalState();
      changed = true;
    }
  }

  /**
   * Get all server states (merged: project overrides global)
   */
  getAllStates(): Record<string, MCPServerState> {
    return {
      ...this.globalState.servers,
      ...this.projectState.servers
    };
  }

  /**
   * Reload project state (useful when workspace changes)
   */
  async reloadProjectState(): Promise<void> {
    await this.loadProjectState();
  }
}

// Singleton instance
let stateServiceInstance: MCPStateService | null = null;

/**
 * Initialize the global state service
 */
export function initializeMCPStateService(): MCPStateService {
  if (!stateServiceInstance) {
    stateServiceInstance = new MCPStateService();
  }
  return stateServiceInstance;
}

/**
 * Get the global state service instance
 */
export function getMCPStateService(): MCPStateService {
  if (!stateServiceInstance) {
    throw new Error('MCP State Service not initialized');
  }
  return stateServiceInstance;
}

/**
 * Cleanup the state service
 */
export function cleanupMCPStateService(): void {
  stateServiceInstance = null;
}