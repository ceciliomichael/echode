/**
 * Session-scoped UI state management for edit and revert flows
 */

interface SessionUiState {
  editingMessageId: string | null;
  revertPreviewMessageId: string | null;
}

const sessionStates = new Map<string, SessionUiState>();

/**
 * Get UI state for a session
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
 * Set editing message for a session
 */
export function setSessionEditingMessage(sessionId: string, messageId: string | null): void {
  const state = getSessionUiState(sessionId);
  state.editingMessageId = messageId;
}

/**
 * Set revert preview message for a session
 */
export function setSessionRevertPreview(sessionId: string, messageId: string | null): void {
  const state = getSessionUiState(sessionId);
  state.revertPreviewMessageId = messageId;
}

/**
 * Clear all UI state for a session
 */
export function clearSessionUiState(sessionId: string): void {
  sessionStates.delete(sessionId);
}
