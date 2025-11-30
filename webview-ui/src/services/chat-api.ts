import type { ChatMessage } from '../types/chat-api';
import type { ChatMode } from '../types/chat-mode';
import { storageService } from '../utils/storage';
import { getProviderDefaults } from '../types/api-settings';
import { UnifiedChatService } from './unified-chat-service';
import { getToolsForMode } from '../lib/tool-config';

export class ChatApiService {
  async *streamChat(messages: ChatMessage[], signal?: AbortSignal, mode: ChatMode = 'agent'): AsyncGenerator<string, void, unknown> {
    const settings = storageService.getSettings();

    if (!settings.provider) {
      throw new Error('API configuration not available. Please configure your API settings in the header settings.');
    }

    // Resolve effective per-provider configuration
    let effectiveApiKey = '';
    let effectiveModel = '';
    let maxTokens = 0;
    let temperature = 0;
    let baseURL = '';
    let qwenCodeOauthPath: string | undefined;

    if (settings.provider === 'anthropic') {
      effectiveApiKey = settings.anthropicApiKey || settings.apiKey || '';
      effectiveModel = settings.anthropicModel || settings.model;
      maxTokens = settings.anthropicMaxTokens;
      temperature = settings.anthropicTemperature;
      baseURL = settings.anthropicCustomUrl?.trim() || getProviderDefaults('anthropic').baseUrl;
    } else if (settings.provider === 'openai') {
      effectiveApiKey = settings.openaiApiKey || settings.apiKey || '';
      effectiveModel = settings.openaiModel || settings.model;
      maxTokens = settings.openaiMaxTokens;
      temperature = settings.openaiTemperature;
      baseURL = settings.openaiCustomUrl?.trim() || getProviderDefaults('openai').baseUrl;
    } else if (settings.provider === 'openai-compatible') {
      effectiveApiKey = settings.openaiCompatibleApiKey || settings.apiKey || '';
      effectiveModel = settings.openaiCompatibleModel || settings.model;
      maxTokens = settings.openaiCompatibleMaxTokens;
      temperature = settings.openaiCompatibleTemperature;
      baseURL = settings.openaiCompatibleCustomUrl?.trim() || getProviderDefaults('openai-compatible').baseUrl;
    } else if (settings.provider === 'megallm') {
      effectiveApiKey = settings.megallmApiKey || settings.apiKey || '';
      effectiveModel = settings.megallmModel || settings.model;
      maxTokens = settings.megallmMaxTokens;
      temperature = settings.megallmTemperature;
      baseURL = getProviderDefaults('megallm').baseUrl;
    } else if (settings.provider === 'qwen-code') {
      // Qwen Code: uses OAuth, no API key
      effectiveApiKey = '';
      effectiveModel = settings.qwenCodeModel || settings.model;
      maxTokens = settings.qwenCodeMaxTokens;
      temperature = settings.qwenCodeTemperature;
      baseURL = getProviderDefaults('qwen-code').baseUrl;
      qwenCodeOauthPath = settings.qwenCodeOauthPath || '~/.qwen/oauth_creds.json';
    } else {
      // VS Code LM: no apiKey/baseURL, provider-specific model/maxTokens
      effectiveApiKey = '';
      effectiveModel = settings.vscodeLmModel || settings.model;
      maxTokens = settings.vscodeLmMaxTokens;
      temperature = settings.vscodeLmTemperature;
      baseURL = '';
    }

    // VS Code LM and Qwen Code don't require API key, others do
    const requiresApiKey = settings.provider !== 'vscode-lm' && settings.provider !== 'qwen-code';
    if ((requiresApiKey && !effectiveApiKey) || !effectiveModel) {
      throw new Error('API configuration not available. Please configure your API settings in the header settings.');
    }

    // Filter tools based on mode (plan mode gets restricted set, agent mode gets all)
    const modeFilteredTools = getToolsForMode(mode, false)
      .filter(tool => {
        // Find the tool in settings to check if it's enabled
        const settingsTool = settings.enabledTools?.find(t => t.id === tool.id);
        return settingsTool?.enabled ?? false;
      });

    // Use unified service singleton that communicates with VSCode backend
    const service = UnifiedChatService.getInstance({
      apiKey: effectiveApiKey,
      model: effectiveModel,
      maxTokens,
      temperature,
      baseURL,
      qwenCodeOauthPath,
      enabledTools: modeFilteredTools,
    }, settings.provider);

    yield* service.streamChat({ messages, signal });
  }
}

export const chatApi = new ChatApiService();
