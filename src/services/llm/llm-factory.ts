import { ILLMProvider, ChatStreamSettings } from './llm-provider.interface';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';
import { OpenAICompatibleProvider } from './openai-compatible-provider';
import { VSCodeLMProvider } from './vscode-lm-provider';
import { QwenProvider } from './qwen-provider';

export class LLMFactory {
  static getProvider(providerName: ChatStreamSettings['provider']): ILLMProvider {
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
