/**
 * Session-scoped UI state management for edit and revert flows
 * Persisted in better-sqlite3 database via extension backend
 */

interface SessionUiState {
  editingMessageId: string | null;
  revertPreviewMessageId: string | null;
}

// In-memory cache for immediate access
const sessionStates = new Map<string, SessionUiState>();

/**
 * Persist UI state to the database via extension
 */
function persistUiState(
  sessionId: string,
  editingMessageId: string | null,
  revertPreviewMessageId: string | null
): void {
  if (window.vscode) {
    window.vscode.postMessage({
      type: 'setSessionUiState',
      sessionId,
      editingMessageId,
      revertPreviewMessageId,
    });
  }
}

/**
 * Get UI state for a session (from cache)
 */
export function getSessionUiState(sessionId: string): SessionUiState {
  if (!sessionStates.has(sessionId)) {
    sessionStates.set(sessionId, {
      editingMessageId: null,
      revertPreviewMessageId: null,
    });
  }
  return sessionStates.get(sessionId)!;
}

/**
 * Load UI state from database and update cache
 * Called when loading a session
 */
export function loadSessionUiState(sessionId: string, uiState: SessionUiState): void {
  sessionStates.set(sessionId, uiState);
}

/**
 * Set editing message for a session and persist to database
 */
export function setSessionEditingMessage(sessionId: string, messageId: string | null): void {
  const state = getSessionUiState(sessionId);
  state.editingMessageId = messageId;
  persistUiState(sessionId, state.editingMessageId, state.revertPreviewMessageId);
}

/**
 * Set revert preview message for a session and persist to database
 */
export function setSessionRevertPreview(sessionId: string, messageId: string | null): void {
  const state = getSessionUiState(sessionId);
  state.revertPreviewMessageId = messageId;
  persistUiState(sessionId, state.editingMessageId, state.revertPreviewMessageId);
}

/**
 * Clear all UI state for a session (from cache only)
 */
export function clearSessionUiState(sessionId: string): void {
  sessionStates.delete(sessionId);
  // Persist the cleared state
  persistUiState(sessionId, null, null);
}
