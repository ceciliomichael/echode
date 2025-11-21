import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import Database from 'better-sqlite3';

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  createdAt: number;
  workspaceId: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
  }>;
  metadata: {
    messageCount: number;
    preview: string;
  };
  uiState?: {
    editingMessageId: string | null;
    revertPreviewMessageId: string | null;
  };
}

interface ChatSessionSummary {
  id: string;
  title: string;
  timestamp: number;
  createdAt: number;
  messageCount: number;
  preview: string;
}

const MAX_SESSIONS = 100;

export class ChatHistoryService {
  private workspaceId: string;
  private db: Database.Database;
  private storageDir: string;

  constructor(
    private context: vscode.ExtensionContext,
    workspacePath?: string
  ) {
    this.workspaceId = this.generateWorkspaceId(workspacePath);
    this.storageDir = path.join(os.homedir(), '.echode', 'history');
    this.ensureStorageDirectory();
    this.db = this.initDatabase();
  }

  private ensureStorageDirectory(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  private initDatabase(): Database.Database {
    const dbPath = path.join(this.storageDir, 'chat-history.db');
    const db = new Database(dbPath);
    
    // Enable WAL mode for better concurrent performance
    db.pragma('journal_mode = WAL');
    
    // Create sessions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0,
        preview TEXT DEFAULT '',
        editing_message_id TEXT DEFAULT NULL,
        revert_preview_message_id TEXT DEFAULT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_workspace_timestamp 
        ON sessions(workspace_id, timestamp DESC);
      
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_session_messages 
        ON messages(session_id);
    `);
    
    // Migration: Add UI state columns if they don't exist
    try {
      const columns = db.pragma('table_info(sessions)') as Array<{ name: string }>;
      const hasEditingMessageId = columns.some(col => col.name === 'editing_message_id');
      const hasRevertPreviewMessageId = columns.some(col => col.name === 'revert_preview_message_id');
      
      if (!hasEditingMessageId) {
        db.exec('ALTER TABLE sessions ADD COLUMN editing_message_id TEXT DEFAULT NULL');
      }
      if (!hasRevertPreviewMessageId) {
        db.exec('ALTER TABLE sessions ADD COLUMN revert_preview_message_id TEXT DEFAULT NULL');
      }
    } catch (error) {
      console.error('Migration error:', error);
    }
    
    return db;
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
  }

  async getAllSessions(): Promise<ChatSessionSummary[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT id, title, timestamp, created_at as createdAt, 
               message_count as messageCount, preview
        FROM sessions
        WHERE workspace_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);
      
      return stmt.all(this.workspaceId, MAX_SESSIONS) as ChatSessionSummary[];
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const sessionStmt = this.db.prepare(`
        SELECT id, workspace_id as workspaceId, title, timestamp, 
               created_at as createdAt, message_count as messageCount, preview,
               editing_message_id as editingMessageId,
               revert_preview_message_id as revertPreviewMessageId
        FROM sessions
        WHERE id = ?
      `);
      
      const session = sessionStmt.get(sessionId) as any;
      if (!session) {
        return null;
      }
      
      const messagesStmt = this.db.prepare(`
        SELECT id, role, content, timestamp
        FROM messages
        WHERE session_id = ?
        ORDER BY timestamp ASC
      `);
      
      const messages = messagesStmt.all(sessionId) as Array<{
        id: string;
        role: string;
        content: string;
        timestamp: string;
      }>;
      
      return {
        id: session.id,
        workspaceId: session.workspaceId,
        title: session.title,
        timestamp: session.timestamp,
        createdAt: session.createdAt,
        messages,
        metadata: {
          messageCount: session.messageCount,
          preview: session.preview
        },
        uiState: {
          editingMessageId: session.editingMessageId,
          revertPreviewMessageId: session.revertPreviewMessageId
        }
      };
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  async saveSession(session: ChatSession): Promise<void> {
    try {
      const transaction = this.db.transaction(() => {
        // Check if session exists
        const existingStmt = this.db.prepare('SELECT id FROM sessions WHERE id = ?');
        const existing = existingStmt.get(session.id);
        
        if (existing) {
          // Update session
          const updateStmt = this.db.prepare(`
            UPDATE sessions 
            SET workspace_id = ?, title = ?, timestamp = ?, 
                message_count = ?, preview = ?
            WHERE id = ?
          `);
          
          updateStmt.run(
            this.workspaceId,
            session.title,
            session.timestamp,
            session.metadata.messageCount,
            session.metadata.preview,
            session.id
          );
          
          // Delete old messages
          const deleteMessagesStmt = this.db.prepare('DELETE FROM messages WHERE session_id = ?');
          deleteMessagesStmt.run(session.id);
        } else {
          // Insert new session
          const insertStmt = this.db.prepare(`
            INSERT INTO sessions (id, workspace_id, title, timestamp, created_at, message_count, preview)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          
          insertStmt.run(
            session.id,
            this.workspaceId,
            session.title,
            session.timestamp,
            session.createdAt,
            session.metadata.messageCount,
            session.metadata.preview
          );
        }
        
        // Insert messages
        const insertMessageStmt = this.db.prepare(`
          INSERT INTO messages (id, session_id, role, content, timestamp)
          VALUES (?, ?, ?, ?, ?)
        `);
        
        for (const message of session.messages) {
          insertMessageStmt.run(
            message.id,
            session.id,
            message.role,
            message.content,
            message.timestamp
          );
        }
        
        // Clean up old sessions if over limit
        const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM sessions WHERE workspace_id = ?');
        const result = countStmt.get(this.workspaceId) as { count: number };
        
        if (result.count > MAX_SESSIONS) {
          const deleteOldStmt = this.db.prepare(`
            DELETE FROM sessions
            WHERE id IN (
              SELECT id FROM sessions
              WHERE workspace_id = ?
              ORDER BY timestamp DESC
              LIMIT -1 OFFSET ?
            )
          `);
          deleteOldStmt.run(this.workspaceId, MAX_SESSIONS);
        }
      });
      
      transaction();
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
      stmt.run(sessionId);
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }

  async clearAllSessions(): Promise<void> {
    try {
      const stmt = this.db.prepare('DELETE FROM sessions WHERE workspace_id = ?');
      stmt.run(this.workspaceId);
    } catch (error) {
      console.error('Failed to clear sessions:', error);
      throw error;
    }
  }

  generateTitle(messages: ChatSession['messages']): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return 'New Chat';
    }
    
    const content = firstUserMessage.content.trim();
    const maxLength = 50;
    
    if (content.length <= maxLength) {
      return content;
    }
    
    return content.substring(0, maxLength).trim() + '...';
  }

  getPreview(messages: ChatSession['messages']): string {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return '';
    }
    
    const content = firstUserMessage.content.trim();
    const maxLength = 100;
    
    if (content.length <= maxLength) {
      return content;
    }
    
    return content.substring(0, maxLength).trim() + '...';
  }

  async getSessionUiState(sessionId: string): Promise<{ editingMessageId: string | null; revertPreviewMessageId: string | null } | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT editing_message_id as editingMessageId, 
               revert_preview_message_id as revertPreviewMessageId
        FROM sessions
        WHERE id = ?
      `);
      
      const result = stmt.get(sessionId) as { editingMessageId: string | null; revertPreviewMessageId: string | null } | undefined;
      return result || null;
    } catch (error) {
      console.error('Failed to get session UI state:', error);
      return null;
    }
  }

  async setSessionUiState(
    sessionId: string,
    editingMessageId: string | null,
    revertPreviewMessageId: string | null
  ): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE sessions 
        SET editing_message_id = ?, revert_preview_message_id = ?
        WHERE id = ?
      `);
      
      stmt.run(editingMessageId, revertPreviewMessageId, sessionId);
    } catch (error) {
      console.error('Failed to set session UI state:', error);
      throw error;
    }
  }

  dispose(): void {
    this.db.close();
  }
}
