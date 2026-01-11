/**
 * Autocomplete Strategies Module
 * Exports all completion strategies and factory function
 */

export * from './types';
export { OpenAICompletionStrategy } from './openai-strategy';
export { QwenCompletionStrategy } from './qwen-strategy';
export { VSCodeLMCompletionStrategy } from './vscode-lm-strategy';

import { ICompletionStrategy, AutocompleteConfig } from './types';
import { OpenAICompletionStrategy } from './openai-strategy';
import { QwenCompletionStrategy } from './qwen-strategy';
import { VSCodeLMCompletionStrategy } from './vscode-lm-strategy';

/**
 * Check if a provider is a custom provider (starts with 'custom-')
 */
function isCustomProvider(providerName: string): boolean {
  return providerName.startsWith('custom-');
}

/**
 * Factory function to create the appropriate completion strategy
 */
export function createCompletionStrategy(config: AutocompleteConfig): ICompletionStrategy {
  const provider = config.provider;

  // Custom providers use OpenAI-compatible API
  if (isCustomProvider(provider)) {
    return new OpenAICompletionStrategy();
  }

  switch (provider) {
    case 'qwen-code':
      return new QwenCompletionStrategy();
    case 'vscode-lm':
      return new VSCodeLMCompletionStrategy();
    case 'anthropic':
    case 'openai':
    case 'openai-compatible':
    case 'megallm':
    default:
      return new OpenAICompletionStrategy();
  }
}