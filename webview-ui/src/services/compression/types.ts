import type { Provider } from '../../types/api-settings';

/**
 * Configuration for the compression service
 */
export interface CompressionConfig {
  provider: Provider;
  model: string;
  apiKey: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Structure of a tool execution for summary
 */
export interface ToolExecutionSummary {
  toolName: string;
  status: string;
  result?: unknown;
}

/**
 * Interface for the message formatter
 */
export interface HistoryFormatter {
  format(messages: unknown[]): string;
}
