import { ChatStreamSettings } from './llm-provider.interface';

/**
 * Service to validate LLM configuration settings before attempting to stream.
 * Helps prevent vague errors by providing clear, actionable feedback when
 * required configuration is missing.
 */
export class LLMValidator {
  /**
   * Validates the chat stream settings for the selected provider.
   * Throws a descriptive error if configuration is missing or invalid.
   */
  static validateSettings(settings: ChatStreamSettings): void {
    const { provider, apiKey, baseURL, qwenCodeOauthPath, chatMode } = settings;

    // Helper to format error message
    const createError = (message: string) => {
      const modeContext = chatMode 
        ? ` (Current Mode: ${chatMode.charAt(0).toUpperCase() + chatMode.slice(1)})` 
        : '';
      return new Error(`${message}${modeContext}`);
    };

    switch (provider) {
      case 'anthropic':
        if (!apiKey || apiKey.trim() === '') {
          throw createError('Anthropic API key is missing. Please configure it in the settings.');
        }
        break;

      case 'openai':
        if (!apiKey || apiKey.trim() === '') {
          throw createError('OpenAI API key is missing. Please configure it in the settings.');
        }
        break;

      case 'openai-compatible':
      case 'megallm':
        if (!baseURL || baseURL.trim() === '') {
          throw createError('Base URL is missing for the custom provider. Please configure it in the settings.');
        }
        // Note: We don't strictly enforce API key for compatible providers as some local models (like Ollama) might not need it,
        // or accept any string. If it's absolutely required by a specific service, the provider will throw a 401.
        break;

      case 'qwen-code':
        // Qwen uses OAuth, so we check if the path or token management is set up
        // This is a basic check; the provider does deeper validation
        if (!qwenCodeOauthPath && !apiKey) {
           // It might rely on internal defaults, but usually needs some config
           // If strict validation is needed, add it here.
           // For now, QwenProvider handles its own auth flow extensively.
        }
        break;

      case 'vscode-lm':
        // No settings validation needed (managed by VS Code)
        break;

      default:
        // For unknown providers (custom ones might fall here if not normalized), check basic requirements
        // Cast to string to avoid "Property 'startsWith' does not exist on type 'never'" error
        const providerName = provider as string;
        if (providerName.startsWith('custom-')) {
           if (!baseURL) {
             throw createError(`Base URL is missing for ${providerName}.`);
           }
        }
        break;
    }
  }
}