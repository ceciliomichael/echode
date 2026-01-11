/**
 * Autocomplete Strategy Types
 * Defines the interface and configuration for autocomplete completion strategies
 */

export interface AutocompleteConfig {
  enabled: boolean;
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  qwenCodeOauthPath?: string;
  debounceMs: number;
  maxTokens: number;
  temperature: number;
}

export interface CompletionContext {
  languageId: string;
  lineBefore: string;
  lineAfter: string;
  contextLines: string[];
}

export interface ICompletionStrategy {
  /**
   * Generate a completion based on the prompt and context
   */
  generateCompletion(
    userPrompt: string,
    systemPrompt: string,
    config: AutocompleteConfig,
    signal: AbortSignal
  ): Promise<string | null>;

  /**
   * Optional cleanup method
   */
  dispose?(): void;
}