import * as vscode from 'vscode';
import type { ChatHistoryService } from '../../services/chat-history-service';

/**
 * Session Handler
 * Handles all chat session CRUD operations and UI state management
 */

type SessionPayload = any;

interface SessionData {
  sessionId?: string;
  session?: SessionPayload;
  editingMessageId?: string | null;
  revertPreviewMessageId?: string | null;
}

/**
 * Save a chat session
 */
export async function handleSaveSession(
  data: SessionData,
  _webview: vscode.WebviewView,
  historyService: ChatHistoryService
): Promise<void> {
  await historyService.saveSession(data.session as SessionPayload);
}

/**
 * Get a specific session by ID
 */
export async function handleGetSession(
  data: SessionData,
  webview: vscode.WebviewView,
  historyService: ChatHistoryService
): Promise<void> {
  const session = await historyService.getSession(data.sessionId!);
  webview.webview.postMessage({
    type: 'sessionLoaded',
    session,
    request: 'session',
    sessionId: data.sessionId
  });
}

/**
 * Get the most recent session
 */
export async function handleGetLatestSession(
  _data: SessionData,
  webview: vscode.WebviewView,
  historyService: ChatHistoryService
): Promise<void> {
  const latestSession = await historyService.getLatestSession();
  webview.webview.postMessage({
    type: 'sessionLoaded',
    session: latestSession,
    request: 'latest'
  });
}

/**
 * Get all sessions for history display
 */
export async function handleGetAllSessions(
  _data: SessionData,
  webview: vscode.WebviewView,
  historyService: ChatHistoryService
): Promise<void> {
  const sessions = await historyService.getAllSessions();
  webview.webview.postMessage({
    type: 'sessionsLoaded',
    sessions
  });
}

/**
 * Delete a session and notify webview
 */
export async function handleDeleteSession(
  data: SessionData,
  webview: vscode.WebviewView,
  historyService: ChatHistoryService
): Promise<void> {
  await historyService.deleteSession(data.sessionId!);
  const updatedSessions = await historyService.getAllSessions();
  webview.webview.postMessage({
    type: 'sessionsUpdated',
    sessions: updatedSessions
  });
  // Notify webview that a session was deleted so it can clear the chat if it's the current one
  webview.webview.postMessage({
    type: 'sessionDeleted',
    sessionId: data.sessionId
  });
}

/**
 * Set UI state for a session (editing, revert preview)
 */
export async function handleSetSessionUiState(
  data: SessionData,
  _webview: vscode.WebviewView,
  historyService: ChatHistoryService
): Promise<void> {
  await historyService.setSessionUiState(
    data.sessionId!,
    data.editingMessageId ?? null,
    data.revertPreviewMessageId ?? null
  );
}

/**
 * Get UI state for a session
 */
export async function handleGetSessionUiState(
  data: SessionData,
  webview: vscode.WebviewView,
  historyService: ChatHistoryService
): Promise<void> {
  const uiState = await historyService.getSessionUiState(data.sessionId!);
  webview.webview.postMessage({
    type: 'sessionUiStateLoaded',
    sessionId: data.sessionId,
    uiState
  });
}