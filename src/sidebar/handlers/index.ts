/**
 * Sidebar Handlers Barrel Export
 */

// Session handlers
export {
  handleSaveSession,
  handleGetSession,
  handleGetLatestSession,
  handleGetAllSessions,
  handleDeleteSession,
  handleSetSessionUiState,
  handleGetSessionUiState,
} from './session-handler';

// Tool history handlers
export {
  handleUndoToolExecutions,
  handleRedoToolExecutions,
} from './tool-history-handler';

// Settings handlers
export {
  handleGetApiSettings,
  handleSaveApiSettings,
  handleClearApiSettings,
  handleGetChatMode,
  handleSaveChatMode,
} from './settings-handler';

// UI handlers
export {
  handleInfo,
  handleError,
  handleOpenFileInTab,
  handleHistoryPanelClosed,
} from './ui-handler';

// Search handlers
export {
  handleSearchFiles,
  handleSearchWorkflows,
} from './search-handler';