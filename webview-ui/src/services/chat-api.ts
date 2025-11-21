import type { ChatMessage } from '../types/chat-api';
import { storageService } from '../utils/storage';
import { getProviderDefaults } from '../types/api-settings';
import { UnifiedChatService } from './unified-chat-service';

export class ChatApiService {
  async *streamChat(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
    const settings = storageService.getSettings();

    // VS Code LM doesn't require API key
    const requiresApiKey = settings.provider !== 'vscode-lm';
    if (!settings.provider || (requiresApiKey && !settings.apiKey) || !settings.model) {
      throw new Error('API configuration not available. Please configure your API settings in the header settings.');
    }

    const maxTokens = settings.provider === 'anthropic' 
      ? settings.anthropicMaxTokens 
      : settings.provider === 'openai' 
      ? settings.openaiMaxTokens 
      : settings.provider === 'openai-compatible'
      ? settings.openaiCompatibleMaxTokens
      : settings.vscodeLmMaxTokens;

    console.log('[Echode API] Provider:', settings.provider);
    console.log('[Echode API] Model:', settings.model);
    console.log('[Echode API] Max Tokens:', maxTokens);

    // Determine base URL based on provider
    let baseURL: string;
    if (settings.provider === 'anthropic') {
      baseURL = settings.anthropicCustomUrl?.trim() || getProviderDefaults('anthropic').baseUrl;
    } else if (settings.provider === 'openai') {
      baseURL = settings.openaiCustomUrl?.trim() || getProviderDefaults('openai').baseUrl;
    } else if (settings.provider === 'openai-compatible') {
      baseURL = settings.openaiCompatibleCustomUrl?.trim() || getProviderDefaults('openai-compatible').baseUrl;
    } else {
      // VS Code LM doesn't use baseURL
      baseURL = '';
    }

    // Use unified service singleton that communicates with VSCode backend
    const service = UnifiedChatService.getInstance({
      apiKey: settings.apiKey || '',
      model: settings.model,
      maxTokens,
      baseURL,
    }, settings.provider);

    yield* service.streamChat({ messages, signal });
  }
}

export const chatApi = new ChatApiService();
