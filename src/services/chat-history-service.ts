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
    let hash = 0;
    for (let i = 0; i < workspacePath.length; i++) {
      const char = workspacePath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ws_${Math.abs(hash).toString(36)}`;
  }

  updateWorkspace(workspacePath?: string): void {
    this.workspaceId = this.generateWorkspaceId(workspacePath);
    this.indexCache = null;
  }

  private readIndex(): IndexEntry[] {
    if (this.indexCache) {
      return this.indexCache;
    }
    try {
      if (fs.existsSync(this.indexPath)) {
        const data = fs.readFileSync(this.indexPath, 'utf-8');
        this.indexCache = JSON.parse(data) as IndexEntry[];
        return this.indexCache;
      }
    } catch (error) {
      console.error('[ChatHistory] Failed to read index:', error);
    }
    this.indexCache = [];
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
