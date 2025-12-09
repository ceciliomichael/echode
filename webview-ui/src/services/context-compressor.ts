import type { Message } from '../types/chat';
import type { ContextSettings, Provider, ApiSettings } from '../types/api-settings';
import { DEFAULT_CONTEXT_SETTINGS, getProviderDefaults } from '../types/api-settings';
import { storageService } from '../utils/storage';

/**
 * Number of recent messages to always keep uncompressed
 * This ensures the AI has immediate context for continuity
 */
const RECENT_MESSAGES_TO_KEEP = 2; // Keep last user + assistant exchange

/**
 * Estimate token count from text (~4 chars per token)
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculate total tokens for a message including tool executions
 */
function calculateMessageTokens(msg: Message): number {
  let tokens = estimateTokens(msg.content);
  
  if (msg.toolExecutions && msg.toolExecutions.size > 0) {
    msg.toolExecutions.forEach((execution) => {
      tokens += estimateTokens(execution.toolName);
      tokens += estimateTokens(JSON.stringify(execution.parameters || {}));
      if (execution.result?.data) {
        tokens += estimateTokens(JSON.stringify(execution.result.data));
      }
    });
  }
  
  return tokens;
}

/**
 * Format a message for summarization (includes tool info)
 */
function formatMessageForSummary(msg: Message): string {
  let formatted = msg.content;
  
  if (msg.toolExecutions && msg.toolExecutions.size > 0) {
    const toolSummaries: string[] = [];
    msg.toolExecutions.forEach((execution) => {
      let toolInfo = `[Tool: ${execution.toolName}]`;
      if (execution.parameters) {
        const paramStr = JSON.stringify(execution.parameters);
        if (paramStr.length < 500) {
          toolInfo += ` Params: ${paramStr}`;
        }
      }
      if (execution.result?.success && execution.result.data) {
        const resultStr = JSON.stringify(execution.result.data);
        // Truncate very long results but keep key info
        if (resultStr.length < 1000) {
          toolInfo += ` Result: ${resultStr}`;
        } else {
          toolInfo += ` Result: [${resultStr.length} chars - truncated]`;
        }
      } else if (execution.result?.error) {
        toolInfo += ` Error: ${execution.result.error}`;
      }
      toolSummaries.push(toolInfo);
    });
    formatted += '\n' + toolSummaries.join('\n');
  }
  
  return formatted;
}

export interface CompressionResult {
  needsCompression: boolean;
  firstMessages: Message[];      // First user message + its responses
  middleMessages: Message[];     // Messages to compress
  recentMessages: Message[];     // Recent messages to keep intact
  estimatedTokens: number;
}

export interface SummaryResult {
  success: boolean;
  summary?: string;
  error?: string;
}

/**
 * Context Compressor Service
 * Handles detection of context overflow and compression of conversation history
 */
export class ContextCompressorService {
  private contextSettings: ContextSettings;

  constructor(contextSettings?: ContextSettings) {
    this.contextSettings = contextSettings || DEFAULT_CONTEXT_SETTINGS;
  }

  /**
   * Update settings
   */
  updateSettings(contextSettings: ContextSettings): void {
    this.contextSettings = contextSettings;
  }

  /**
   * Check if compression is needed and segment messages
   */
  analyzeContext(
    messages: Message[],
    systemPromptTokens: number,
    newMessageTokens: number
  ): CompressionResult {
    const maxTokens = this.contextSettings.maxContextTokens;
    
    // Calculate current context tokens
    let currentTokens = systemPromptTokens;
    messages.forEach((msg) => {
      currentTokens += calculateMessageTokens(msg);
    });
    
    const totalAfterNewMessage = currentTokens + newMessageTokens;
    
    // Debug logging
    console.log('[ContextCompressor] analyzeContext:', {
      messageCount: messages.length,
      systemPromptTokens,
      currentTokens,
      newMessageTokens,
      totalAfterNewMessage,
      maxTokens,
      needsCompression: totalAfterNewMessage >= maxTokens,
    });
    
    // Check if compression is needed
    if (totalAfterNewMessage < maxTokens) {
      return {
        needsCompression: false,
        firstMessages: [],
        middleMessages: [],
        recentMessages: messages,
        estimatedTokens: totalAfterNewMessage,
      };
    }

    // Need to compress - segment messages
    // First message block: first user message and all subsequent assistant/tool responses until next user message
    const firstMessages: Message[] = [];
    const middleMessages: Message[] = [];
    const recentMessages: Message[] = [];
    
    // Need at least 4 messages: first user + first assistant + 1 middle + 1 recent
    if (messages.length < 4) {
      console.log('[ContextCompressor] Not enough messages to compress:', {
        messageCount: messages.length,
        minRequired: 4,
      });
      return {
        needsCompression: false,
        firstMessages: [],
        middleMessages: [],
        recentMessages: messages,
        estimatedTokens: totalAfterNewMessage,
      };
    }

    // Find first user message block (user message + following assistant responses)
    let firstBlockEnd = 0;
    if (messages.length > 0 && messages[0].role === 'user') {
      firstMessages.push(messages[0]);
      firstBlockEnd = 1;
      
      // Include assistant responses until next user message
      while (firstBlockEnd < messages.length && messages[firstBlockEnd].role === 'assistant') {
        firstMessages.push(messages[firstBlockEnd]);
        firstBlockEnd++;
      }
    }

    // Recent messages: last N messages
    const recentStart = Math.max(firstBlockEnd, messages.length - RECENT_MESSAGES_TO_KEEP);
    
    // Everything in between is middle (to be compressed)
    for (let i = firstBlockEnd; i < recentStart; i++) {
      middleMessages.push(messages[i]);
    }
    
    // Recent messages
    for (let i = recentStart; i < messages.length; i++) {
      recentMessages.push(messages[i]);
    }

    // Only compress if there's meaningful content in middle
    if (middleMessages.length < 2) {
      // Fallback: if we're already over the token limit but the middle slice is too small,
      // compress everything except the most recent RECENT_MESSAGES_TO_KEEP messages.
      if (totalAfterNewMessage >= maxTokens && messages.length > RECENT_MESSAGES_TO_KEEP) {
        const hardRecentStart = Math.max(0, messages.length - RECENT_MESSAGES_TO_KEEP);
        const hardMiddle: Message[] = [];
        const hardRecent: Message[] = [];

        for (let i = 0; i < hardRecentStart; i++) {
          hardMiddle.push(messages[i]);
        }
        for (let i = hardRecentStart; i < messages.length; i++) {
          hardRecent.push(messages[i]);
        }

        if (hardMiddle.length >= 1) {
          console.log('[ContextCompressor] Using hard overflow compression mode:', {
            messageCount: messages.length,
            hardMiddleCount: hardMiddle.length,
            hardRecentCount: hardRecent.length,
          });

          return {
            needsCompression: true,
            firstMessages: [],
            middleMessages: hardMiddle,
            recentMessages: hardRecent,
            estimatedTokens: totalAfterNewMessage,
          };
        }
      }

      return {
        needsCompression: false,
        firstMessages: [],
        middleMessages: [],
        recentMessages: messages,
        estimatedTokens: totalAfterNewMessage,
      };
    }

    return {
      needsCompression: true,
      firstMessages,
      middleMessages,
      recentMessages,
      estimatedTokens: totalAfterNewMessage,
    };
  }

  /**
   * Request summary from backend
   */
  async requestSummary(middleMessages: Message[]): Promise<SummaryResult> {
    return new Promise((resolve) => {
      const requestId = `summary-${Date.now()}`;
      
      // Get summarizer settings
      const settings = storageService.getSettings();
      const contextSettings = settings.contextSettings || DEFAULT_CONTEXT_SETTINGS;
      const provider = contextSettings.summarizerProvider;
      const model = contextSettings.summarizerModel;

      if (!model) {
        resolve({
          success: false,
          error: 'No summarizer model configured. Please configure in Context settings.',
        });
        return;
      }

      // Get API configuration for the selected provider
      const apiConfig = this.getProviderConfig(settings, provider);

      // Format messages for summarization
      const formattedMessages = middleMessages.map((msg) => ({
        role: msg.role,
        content: formatMessageForSummary(msg),
      }));

      // Listen for response
      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        
        if (message.type === 'contextSummaryComplete' && message.requestId === requestId) {
          window.removeEventListener('message', handleMessage);
          resolve({
            success: true,
            summary: message.summary,
          });
        } else if (message.type === 'contextSummaryError' && message.requestId === requestId) {
          window.removeEventListener('message', handleMessage);
          resolve({
            success: false,
            error: message.error,
          });
        }
      };

      window.addEventListener('message', handleMessage);

      // Send request to backend
      if (window.vscode) {
        window.vscode.postMessage({
          type: 'summarizeContext',
          requestId,
          messages: formattedMessages,
          settings: {
            provider,
            model,
            ...apiConfig,
          },
        });
      } else {
        window.removeEventListener('message', handleMessage);
        resolve({
          success: false,
          error: 'VS Code API not available',
        });
      }

      // Timeout after 60 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        resolve({
          success: false,
          error: 'Summarization timed out',
        });
      }, 60000);
    });
  }

  /**
   * Get provider-specific API configuration
   */
  private getProviderConfig(
    settings: ApiSettings,
    provider: Provider
  ): { apiKey?: string; baseURL?: string; maxTokens?: number; temperature?: number } {
    const defaults = getProviderDefaults(provider);
    
    switch (provider) {
      case 'anthropic':
        return {
          apiKey: settings.anthropicApiKey || settings.apiKey,
          baseURL: settings.anthropicCustomUrl || defaults.baseUrl,
          maxTokens: 4096,
          temperature: 0.3,
        };
      case 'openai':
        return {
          apiKey: settings.openaiApiKey || settings.apiKey,
          baseURL: settings.openaiCustomUrl || defaults.baseUrl,
          maxTokens: 4096,
          temperature: 0.3,
        };
      case 'openai-compatible':
        return {
          apiKey: settings.openaiCompatibleApiKey || settings.apiKey,
          baseURL: settings.openaiCompatibleCustomUrl || defaults.baseUrl,
          maxTokens: 4096,
          temperature: 0.3,
        };
      case 'megallm':
        return {
          apiKey: settings.megallmApiKey || settings.apiKey,
          baseURL: defaults.baseUrl,
          maxTokens: 4096,
          temperature: 0.3,
        };
      case 'qwen-code':
        return {
          baseURL: defaults.baseUrl,
          maxTokens: 4096,
          temperature: 0.3,
        };
      default:
        return {
          maxTokens: 4096,
          temperature: 0.3,
        };
    }
  }
}

// Singleton instance
let compressorInstance: ContextCompressorService | null = null;

export function getContextCompressor(contextSettings?: ContextSettings): ContextCompressorService {
  if (!compressorInstance) {
    compressorInstance = new ContextCompressorService(contextSettings);
  } else if (contextSettings) {
    compressorInstance.updateSettings(contextSettings);
  }
  return compressorInstance;
}
