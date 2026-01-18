import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { ToolExecutionState } from '../types/tool-execution';

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  toolExecutions?: Array<[string, ToolExecutionState]>;
  attachments?: unknown;
  hidden?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  createdAt: number;
  workspaceId: string;
  messages: ChatMessage[];
  metadata: {
    messageCount: number;
    preview: string;
  };
  uiState?: {
    editingMessageId: string | null;
    revertPreviewMessageId: string | null;
  };
  /** Original messages before compression, used for revert functionality */
  preCompressionMessages?: ChatMessage[];
}

interface ChatSessionSummary {
  id: string;
  title: string;
  timestamp: number;
  createdAt: number;
  messageCount: number;
  preview: string;
}

interface IndexEntry {
  id: string;
  workspaceId: string;
  title: string;
  timestamp: number;
  createdAt: number;
  messageCount: number;
  preview: string;
}

const MAX_SESSIONS = 100;

export class ChatHistoryService {
  private workspaceId: string;
  private storageDir: string;
  private sessionsDir: string;
  private indexPath: string;
  private indexCache: IndexEntry[] | null = null;

  constructor(
    private context: vscode.ExtensionContext,
    workspacePath?: string
  ) {
    this.workspaceId = this.generateWorkspaceId(workspacePath);
    this.storageDir = path.join(os.homedir(), '.echode', 'history');
    this.sessionsDir = path.join(this.storageDir, 'sessions');
    this.indexPath = path.join(this.storageDir, 'index.json');
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        fs.mkdirSync(this.sessionsDir, { recursive: true });
      }
    } catch (error) {
      console.error('[ChatHistory] Failed to create storage directory:', error);
    }
  }

  private generateWorkspaceId(workspacePath?: string): string {
    if (!workspacePath) {
      return 'global';
    }
    let normalizedPath = workspacePath;
    try {
      normalizedPath = path.resolve(workspacePath);
      normalizedPath = path.normalize(normalizedPath);
      if (process.platform === 'win32') {
        normalizedPath = normalizedPath.toLowerCase();
      }
      normalizedPath = normalizedPath.replace(/[\\/]+$/, '');
    } catch (_error) {
      normalizedPath = workspacePath;
    }
    let hash = 0;
    for (let i = 0; i < normalizedPath.length; i++) {
      const char = normalizedPath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ws_${Math.abs(hash).toString(36)}`;
  }

  updateWorkspace(workspacePath?: string): void {
    this.workspaceId = this.generateWorkspaceId(workspacePath);
    this.indexCache = null;
  }

  private getLastOpenedSessionKey(): string {
    return `echode.lastOpenedSession.${this.workspaceId}`;
  }

  public getLastOpenedSessionId(): string | null {
    try {
      return this.context.globalState.get<string>(this.getLastOpenedSessionKey()) ?? null;
    } catch (_error) {
      return null;
    }
  }

  public setLastOpenedSessionId(sessionId: string): void {
    try {
      void this.context.globalState.update(this.getLastOpenedSessionKey(), sessionId);
    } catch (_error) {
    }
  }

  private getSessionFilesOnDisk(): Map<string, string> {
    const result = new Map<string, string>();
    try {
      if (!fs.existsSync(this.sessionsDir)) {
        return result;
      }

      const files = fs.readdirSync(this.sessionsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.slice(0, -'.json'.length);
          result.set(sessionId, path.join(this.sessionsDir, file));
          continue;
        }
        if (file.endsWith('.json.tmp')) {
          const sessionId = file.slice(0, -'.json.tmp'.length);
          if (!result.has(sessionId)) {
            result.set(sessionId, path.join(this.sessionsDir, file));
          }
        }
      }
    } catch (error) {
      console.error('[ChatHistory] Failed to list session files:', error);
    }
    return result;
  }

  private readSessionFromFilePath(filePath: string): ChatSession | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as ChatSession;
    } catch (error) {
      console.error('[ChatHistory] Failed to read session file:', filePath, error);
      return null;
    }
  }

  private buildIndexEntry(session: ChatSession): IndexEntry | null {
    if (!session?.id) {
      return null;
    }

    const messageCount = session.metadata?.messageCount ?? session.messages?.length ?? 0;
    const preview = session.metadata?.preview ?? '';
    const timestamp = typeof session.timestamp === 'number'
      ? session.timestamp
      : (typeof session.createdAt === 'number' ? session.createdAt : Date.now());
    const createdAt = typeof session.createdAt === 'number' ? session.createdAt : timestamp;
    const title = typeof session.title === 'string' ? session.title : 'New Chat';
    const workspaceId = typeof session.workspaceId === 'string' ? session.workspaceId : 'global';

    return {
      id: session.id,
      workspaceId,
      title,
      timestamp,
      createdAt,
      messageCount,
      preview,
    };
  }

  private repairIndex(existing: IndexEntry[], forceRebuild: boolean): IndexEntry[] {
    const sessionFiles = this.getSessionFilesOnDisk();
    if (sessionFiles.size === 0) {
      return existing;
    }

    const byId = new Map<string, IndexEntry>();
    for (const entry of existing) {
      if (entry?.id) {
        byId.set(entry.id, entry);
      }
    }

    let changed = false;
    for (const [sessionId, filePath] of sessionFiles.entries()) {
      if (!forceRebuild && byId.has(sessionId)) {
        continue;
      }

      const session = this.readSessionFromFilePath(filePath);
      if (!session) {
        continue;
      }

      const indexEntry = this.buildIndexEntry(session);
      if (!indexEntry) {
        continue;
      }

      const existingEntry = byId.get(indexEntry.id);
      if (!existingEntry) {
        byId.set(indexEntry.id, indexEntry);
        changed = true;
        continue;
      }

      if (forceRebuild) {
        byId.set(indexEntry.id, indexEntry);
        changed = true;
      }
    }

    const repaired = Array.from(byId.values());
    if (changed) {
      try {
        this.writeIndex(repaired);
      } catch (error) {
        console.error('[ChatHistory] Failed to persist repaired index:', error);
      }
    }
    return repaired;
  }

  private readIndex(): IndexEntry[] {
    if (this.indexCache) {
      return this.indexCache;
    }
    let forceRebuild = false;
    try {
      if (fs.existsSync(this.indexPath)) {
        const data = fs.readFileSync(this.indexPath, 'utf-8');
        this.indexCache = JSON.parse(data) as IndexEntry[];
      } else {
        const tmpPath = this.indexPath + '.tmp';
        if (fs.existsSync(tmpPath)) {
          const data = fs.readFileSync(tmpPath, 'utf-8');
          this.indexCache = JSON.parse(data) as IndexEntry[];
          try {
            fs.renameSync(tmpPath, this.indexPath);
          } catch (_error) {
          }
        }
      }
    } catch (error) {
      console.error('[ChatHistory] Failed to read index:', error);
      forceRebuild = true;
    }
    if (!this.indexCache) {
      this.indexCache = [];
    }

    const sessionFiles = this.getSessionFilesOnDisk();
    const uniqueIndexIds = new Set(this.indexCache.map(e => e.id));
    if (forceRebuild || sessionFiles.size > uniqueIndexIds.size) {
      this.indexCache = this.repairIndex(this.indexCache, forceRebuild);
    }

    return this.indexCache;
  }

  private writeIndex(entries: IndexEntry[]): void {
    try {
      const tmpPath = this.indexPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(entries, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.indexPath);
      this.indexCache = entries;
    } catch (error) {
      console.error('[ChatHistory] Failed to write index:', error);
      throw error;
    }
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  private readSessionFile(sessionId: string): ChatSession | null {
    try {
      const sessionPath = this.getSessionPath(sessionId);
      if (fs.existsSync(sessionPath)) {
        const data = fs.readFileSync(sessionPath, 'utf-8');
        return JSON.parse(data) as ChatSession;
      }

      const tmpPath = sessionPath + '.tmp';
      if (fs.existsSync(tmpPath)) {
        const data = fs.readFileSync(tmpPath, 'utf-8');
        const session = JSON.parse(data) as ChatSession;
        try {
          fs.renameSync(tmpPath, sessionPath);
        } catch (_error) {
        }
        return session;
      }
    } catch (error) {
      console.error('[ChatHistory] Failed to read session file:', sessionId, error);
    }
    return null;
  }

  private writeSessionFile(session: ChatSession): void {
    try {
      const sessionPath = this.getSessionPath(session.id);
      const tmpPath = sessionPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(session, null, 2), 'utf-8');
      fs.renameSync(tmpPath, sessionPath);
    } catch (error) {
      console.error('[ChatHistory] Failed to write session file:', session.id, error);
      throw error;
    }
  }

  private deleteSessionFile(sessionId: string): void {
    try {
      const sessionPath = this.getSessionPath(sessionId);
      if (fs.existsSync(sessionPath)) {
        fs.unlinkSync(sessionPath);
      }

      const tmpPath = sessionPath + '.tmp';
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch (error) {
      console.error('[ChatHistory] Failed to delete session file:', sessionId, error);
    }
  }

  async getAllSessions(): Promise<ChatSessionSummary[]> {
    try {
      const index = this.readIndex();
      const workspaceSessions = index
        .filter(entry => entry.workspaceId === this.workspaceId)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_SESSIONS);

      return workspaceSessions.map(entry => ({
        id: entry.id,
        title: entry.title,
        timestamp: entry.timestamp,
        createdAt: entry.createdAt,
        messageCount: entry.messageCount,
        preview: entry.preview,
      }));
    } catch (error) {
      console.error('[ChatHistory] Failed to get sessions:', error);
      return [];
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const session = this.readSessionFile(sessionId);
      if (session?.workspaceId && session.workspaceId !== this.workspaceId) {
        return null;
      }
      if (session?.id) {
        this.setLastOpenedSessionId(session.id);
      }
      return session;
    } catch (error) {
      console.error('[ChatHistory] Failed to get session:', error);
      return null;
    }
  }

  async getLatestSession(): Promise<ChatSession | null> {
    try {
      const index = this.readIndex();
      const latest = index
        .filter(entry => entry.workspaceId === this.workspaceId)
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (!latest) {
        return null;
      }

      const session = this.readSessionFile(latest.id);
      if (session?.workspaceId && session.workspaceId !== this.workspaceId) {
        return null;
      }

      return session;
    } catch (error) {
      console.error('[ChatHistory] Failed to get latest session:', error);
      return null;
    }
  }

  async saveSession(session: ChatSession): Promise<void> {
    try {
      // Ensure workspaceId is set
      session.workspaceId = this.workspaceId;

      // Write session file atomically
      this.writeSessionFile(session);

      this.setLastOpenedSessionId(session.id);

      // Update index
      const index = this.readIndex();
      const existingIdx = index.findIndex(e => e.id === session.id);

      const indexEntry: IndexEntry = {
        id: session.id,
        workspaceId: this.workspaceId,
        title: session.title,
        timestamp: session.timestamp,
        createdAt: session.createdAt,
        messageCount: session.metadata.messageCount,
        preview: session.metadata.preview,
      };

      if (existingIdx !== -1) {
        index[existingIdx] = indexEntry;
      } else {
        index.push(indexEntry);
      }

      // Enforce MAX_SESSIONS per workspace
      const workspaceSessions = index
        .filter(e => e.workspaceId === this.workspaceId)
        .sort((a, b) => b.timestamp - a.timestamp);

      if (workspaceSessions.length > MAX_SESSIONS) {
        const toDelete = workspaceSessions.slice(MAX_SESSIONS);
        for (const entry of toDelete) {
          this.deleteSessionFile(entry.id);
        }
        const idsToDelete = new Set(toDelete.map(e => e.id));
        const filtered = index.filter(e => !idsToDelete.has(e.id));
        this.writeIndex(filtered);
      } else {
        this.writeIndex(index);
      }
    } catch (error) {
      console.error('[ChatHistory] Failed to save session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      this.deleteSessionFile(sessionId);

      const index = this.readIndex();
      const filtered = index.filter(e => e.id !== sessionId);
      this.writeIndex(filtered);
    } catch (error) {
      console.error('[ChatHistory] Failed to delete session:', error);
      throw error;
    }
  }

  async clearAllSessions(): Promise<void> {
    try {
      const index = this.readIndex();
      const toDelete = index.filter(e => e.workspaceId === this.workspaceId);

      for (const entry of toDelete) {
        this.deleteSessionFile(entry.id);
      }

      const filtered = index.filter(e => e.workspaceId !== this.workspaceId);
      this.writeIndex(filtered);
    } catch (error) {
      console.error('[ChatHistory] Failed to clear sessions:', error);
      throw error;
    }
  }

  generateTitle(messages: ChatSession['messages']): string {
    const ATTACHED_FILE_REGEX = /<attached_file>\s*([\s\S]*?)<\/attached_file>/g;
    const COMPRESSED_HISTORY_REGEX = /<compressed_history>[\s\S]*?<\/compressed_history>/g;

    for (const message of messages) {
      if (message.role !== 'user') {
        continue;
      }

      let content = message.content;
      content = content.replace(ATTACHED_FILE_REGEX, '');
      content = content.replace(COMPRESSED_HISTORY_REGEX, '');
      content = content.trim();

      if (content.length > 0) {
        const maxLength = 50;
        if (content.length <= maxLength) {
          return content;
        }
        return content.substring(0, maxLength).trim() + '...';
      }
    }

    // Fallback checks
    const hasHistory = messages.some(m => m.content.includes('<compressed_history>'));
    if (hasHistory) {
      return 'Restored Session';
    }

    return 'New Chat';
  }

  getPreview(messages: ChatSession['messages']): string {
    const ATTACHED_FILE_REGEX = /<attached_file>\s*([\s\S]*?)<\/attached_file>/g;
    const COMPRESSED_HISTORY_REGEX = /<compressed_history>[\s\S]*?<\/compressed_history>/g;

    for (const message of messages) {
      if (message.role !== 'user') {
        continue;
      }

      let content = message.content;
      content = content.replace(ATTACHED_FILE_REGEX, '');
      content = content.replace(COMPRESSED_HISTORY_REGEX, '');
      content = content.trim();

      if (content.length > 0) {
        const maxLength = 100;
        if (content.length <= maxLength) {
          return content;
        }
        return content.substring(0, maxLength).trim() + '...';
      }
    }

    return '';
  }

  async getSessionUiState(sessionId: string): Promise<{ editingMessageId: string | null; revertPreviewMessageId: string | null } | null> {
    try {
      const session = this.readSessionFile(sessionId);
      if (session?.uiState) {
        return session.uiState;
      }
      return { editingMessageId: null, revertPreviewMessageId: null };
    } catch (error) {
      console.error('[ChatHistory] Failed to get session UI state:', error);
      return null;
    }
  }

  async setSessionUiState(
    sessionId: string,
    editingMessageId: string | null,
    revertPreviewMessageId: string | null
  ): Promise<void> {
    try {
      const session = this.readSessionFile(sessionId);
      if (session) {
        session.uiState = { editingMessageId, revertPreviewMessageId };
        this.writeSessionFile(session);
      }
    } catch (error) {
      console.error('[ChatHistory] Failed to set session UI state:', error);
      throw error;
    }
  }

  dispose(): void {
    // No resources to clean up for JSON storage
    this.indexCache = null;
  }
}
