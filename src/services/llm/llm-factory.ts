import { ILLMProvider, ChatStreamSettings } from './llm-provider.interface';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';
import { OpenAICompatibleProvider } from './openai-compatible-provider';
import { VSCodeLMProvider } from './vscode-lm-provider';
import { QwenProvider } from './qwen-provider';

/**
 * Check if a provider is a custom provider (starts with 'custom-')
 */
function isCustomProvider(providerName: string): boolean {
  return providerName.startsWith('custom-');
}

export class LLMFactory {
  static getProvider(providerName: ChatStreamSettings['provider']): ILLMProvider {
    // Custom providers are OpenAI-compatible
    if (isCustomProvider(providerName)) {
      return new OpenAICompatibleProvider();
    }

    switch (providerName) {
      case 'anthropic':
        return new AnthropicProvider();
      case 'openai':
        return new OpenAIProvider();
      case 'openai-compatible':
      case 'megallm':
        return new OpenAICompatibleProvider();
      case 'vscode-lm':
        return new VSCodeLMProvider();
      case 'qwen-code':
        return new QwenProvider();
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }
}
