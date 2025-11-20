import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
  private storageDir: string;

  constructor(
    private context: vscode.ExtensionContext,
    workspacePath?: string
  ) {
    this.workspaceId = this.generateWorkspaceId(workspacePath);
    this.storageDir = path.join(os.homedir(), '.echode', 'history');
    this.ensureStorageDirectory();
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

  private getStorageFilePath(): string {
    return path.join(this.storageDir, `${this.workspaceId}.json`);
  }

  private readSessionsFromFile(): ChatSession[] {
    try {
      const filePath = this.getStorageFilePath();
      if (!fs.existsSync(filePath)) {
        return [];
      }
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to read sessions from file:', error);
      return [];
    }
  }

  private writeSessionsToFile(sessions: ChatSession[]): void {
    try {
      const filePath = this.getStorageFilePath();
      fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to write sessions to file:', error);
      throw error;
    }
  }

  private generateWorkspaceId(workspacePath?: string): string {
    if (!workspacePath) {
      return 'global';
    }
    // Create a simple hash from the workspace path
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
      const sessions = this.readSessionsFromFile();
      return sessions
        .map(session => ({
          id: session.id,
          title: session.title,
          timestamp: session.timestamp,
          createdAt: session.createdAt,
          messageCount: session.metadata.messageCount,
          preview: session.metadata.preview,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const sessions = this.readSessionsFromFile();
      return sessions.find(s => s.id === sessionId) || null;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  async saveSession(session: ChatSession): Promise<void> {
    try {
      let sessions = this.readSessionsFromFile();
      
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.unshift(session);
        
        if (sessions.length > MAX_SESSIONS) {
          sessions = sessions.slice(0, MAX_SESSIONS);
        }
      }
      
      // Ensure session has workspace ID
      if (existingIndex >= 0) {
        sessions[existingIndex].workspaceId = this.workspaceId;
      } else {
        sessions[0].workspaceId = this.workspaceId;
      }
      
      this.writeSessionsToFile(sessions);
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = this.readSessionsFromFile();
      const filtered = sessions.filter(s => s.id !== sessionId);
      this.writeSessionsToFile(filtered);
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }

  async clearAllSessions(): Promise<void> {
    try {
      this.writeSessionsToFile([]);
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
}
