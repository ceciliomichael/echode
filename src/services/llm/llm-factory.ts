import { ILLMProvider, ChatStreamSettings } from './llm-provider.interface';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';
import { OpenAICompatibleProvider } from './openai-compatible-provider';

export class LLMFactory {
  static getProvider(providerName: ChatStreamSettings['provider']): ILLMProvider {
    switch (providerName) {
      case 'anthropic':
        return new AnthropicProvider();
      case 'openai':
        return new OpenAIProvider();
      case 'openai-compatible':
        return new OpenAICompatibleProvider();
      default:
        throw new Error(`Unknown provider: ${providerName}`);
    }
  }
}
