import type { Message } from '../types/chat';
import type { Provider } from '../types/api-settings';
import { UnifiedChatService } from './unified-chat-service';
import { storageService } from '../utils/storage';
import { getProviderDefaults } from '../types/api-settings';

/**
 * Summarization prompt for compressing conversation history
 */
const SUMMARIZATION_SYSTEM_PROMPT = `You are a conversation summarizer. Your task is to create a concise but comprehensive summary of the conversation history provided.

The summary should:
1. Preserve all critical context needed to continue the conversation
2. Include key decisions, conclusions, and important information discussed
3. List any files that were read, created, or modified
4. Capture the current task state and any pending work
5. Be structured and easy to parse

Format your response as:

## Context Summary

### Key Topics & Decisions
- [List main topics discussed and decisions made]

### Files Involved
- [List files read/created/modified with brief notes]

### Current State
- [What was being worked on, any pending tasks]

### Important Details
- [Any critical information that must be preserved]

Be concise but thorough. Do not include unnecessary pleasantries or filler text.`;

/**
 * Format messages for summarization
 */
function formatMessagesForSummarization(messages: Message[]): string {
  const formatted: string[] = [];

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    let content = msg.content;

    // Truncate very long messages to avoid token explosion
    if (content.length > 2000) {
      content = content.substring(0, 2000) + '\n...[truncated]';
    }

    formatted.push(`### ${role}:\n${content}`);

    // Include tool execution summaries if present
    if (msg.toolExecutions && msg.toolExecutions.size > 0) {
      const toolSummaries: string[] = [];
      msg.toolExecutions.forEach((execution) => {
        const status = execution.status === 'completed' ? '✓' : '✗';
        let summary = `${status} ${execution.toolName}`;

        // Add key parameters for context
        if (execution.parameters) {
          if (execution.parameters.path) {
            summary += ` (${execution.parameters.path})`;
          } else if (execution.parameters.query) {
            summary += ` (${String(execution.parameters.query).substring(0, 50)}...)`;
          }
        }

        toolSummaries.push(summary);
      });

      if (toolSummaries.length > 0) {
        formatted.push(`Tools used: ${toolSummaries.join(', ')}`);
      }
    }

    formatted.push(''); // Empty line between messages
  }

  return formatted.join('\n');
}

/**
 * Get provider-specific configuration for summarization
 */
function getSummarizationConfig(provider: Provider, model: string) {
  const settings = storageService.getSettings();

  let apiKey = '';
  let baseURL = '';

  switch (provider) {
    case 'anthropic':
      apiKey = settings.anthropicApiKey || '';
      baseURL = settings.anthropicCustomUrl?.trim() || getProviderDefaults('anthropic').baseUrl;
      break;
    case 'openai':
      apiKey = settings.openaiApiKey || '';
      baseURL = settings.openaiCustomUrl?.trim() || getProviderDefaults('openai').baseUrl;
      break;
    case 'openai-compatible':
      apiKey = settings.openaiCompatibleApiKey || '';
      baseURL = settings.openaiCompatibleCustomUrl?.trim() || getProviderDefaults('openai-compatible').baseUrl;
      break;
    case 'megallm':
      apiKey = settings.megallmApiKey || '';
      baseURL = getProviderDefaults('megallm').baseUrl;
      break;
    case 'vscode-lm':
      apiKey = '';
      baseURL = '';
      break;
    case 'qwen-code':
      apiKey = '';
      baseURL = getProviderDefaults('qwen-code').baseUrl;
      break;
  }

  return {
    apiKey,
    model,
    maxTokens: 2048, // Summaries should be concise
    temperature: 0.3, // Low temperature for consistent summaries
    baseURL,
    qwenCodeOauthPath: provider === 'qwen-code' ? settings.qwenCodeOauthPath : undefined,
    enabledTools: [], // No tools needed for summarization
    chatMode: 'chat' as const,
    streamingTimeout: settings.streamingTimeout || 5000,
  };
}

export interface SummarizationResult {
  summary: string;
  originalMessageCount: number;
  success: boolean;
  error?: string;
}

/**
 * Service for summarizing conversation history using LLM
 */
export class SummarizationService {
  /**
   * Summarize a list of messages into a concise summary
   */
  static async summarizeMessages(
    messages: Message[],
    provider: Provider,
    model: string
  ): Promise<SummarizationResult> {
    if (messages.length === 0) {
      return {
        summary: '',
        originalMessageCount: 0,
        success: true,
      };
    }

    // Validate model is configured
    if (!model) {
      return {
        summary: '',
        originalMessageCount: messages.length,
        success: false,
        error: 'Summarization model not configured',
      };
    }

    try {
      const formattedMessages = formatMessagesForSummarization(messages);
      const config = getSummarizationConfig(provider, model);

      const service = UnifiedChatService.getInstance(config, provider);

      const chatMessages = [
        { role: 'system' as const, content: SUMMARIZATION_SYSTEM_PROMPT },
        {
          role: 'user' as const,
          content: `Please summarize the following conversation:\n\n${formattedMessages}`,
        },
      ];

      // Collect streamed response
      let summary = '';
      for await (const chunk of service.streamChat({ messages: chatMessages })) {
        summary += chunk;
      }

      // Validate we got a reasonable response
      if (!summary || summary.length < 50) {
        return {
          summary: '',
          originalMessageCount: messages.length,
          success: false,
          error: 'Summarization produced empty or too short response',
        };
      }

      console.log(`[SummarizationService] Summarized ${messages.length} messages into ${summary.length} chars`);

      return {
        summary: summary.trim(),
        originalMessageCount: messages.length,
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SummarizationService] Error summarizing messages:', errorMessage);

      return {
        summary: '',
        originalMessageCount: messages.length,
        success: false,
        error: errorMessage,
      };
    }
  }
}