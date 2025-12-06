/**
 * Type definitions for sub-agent service
 */

/**
 * Indexing settings from user config
 */
export interface IndexingSettings {
  provider: 'anthropic' | 'openai' | 'openai-compatible' | 'megallm' | 'vscode-lm' | 'qwen-code';
  model: string;
}

/**
 * API settings needed for sub-agent
 */
export interface SubAgentApiSettings {
  anthropicApiKey?: string;
  anthropicCustomUrl?: string;
  openaiApiKey?: string;
  openaiCustomUrl?: string;
  openaiCompatibleApiKey?: string;
  openaiCompatibleCustomUrl?: string;
  megallmApiKey?: string;
  megallmCustomUrl?: string;
}

/**
 * Search snippet result
 */
export interface SearchSnippet {
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  score: number;
  reason?: string;
}

/**
 * Sub-agent search result
 */
export interface SubAgentResult {
  summary: string;
  highLevelAnswer?: string;
  snippets: SearchSnippet[];
  searchStats: SearchStats;
}

/**
 * Search statistics
 */
export interface SearchStats {
  iterations: number;
  grepCalls: number;
  globCalls: number;
  readFileCalls: number;
  listDirCalls: number;
  filesScanned: number;
  totalMatches: number;
}

/**
 * Progress callback for streaming updates
 */
export type ProgressCallback = (message: string) => void;

/**
 * Message in the conversation
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Tool call structure
 */
export interface ToolCall {
  name: string;
  params: Record<string, string>;
}

/**
 * Discovered file info for fallback
 */
export interface DiscoveredFileInfo {
  lines?: { start: number; end: number };
  reason?: string;
}