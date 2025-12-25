import type { ImageAttachment } from '../types/chat';
import type { ChatMessage, ChatMessageContent } from '../types/chat-api';
import { storageService } from './storage';

/**
 * Check if a model supports vision/image inputs
 * Note: Always returns true to allow vision on all models
 * If a model doesn't support vision, the API will handle it gracefully
 */

export function isVisionCapableModel(_modelName: string): boolean {
  // Enable vision for all models - let the API handle unsupported models
  return true;
}

/**
 * Build a chat message with optional image attachments
 * If model doesn't support vision, images are excluded
 */
export function buildChatMessage(
  role: string,
  content: string,
  attachments?: ImageAttachment[],
  modelSupportsVision: boolean = true
): ChatMessage {
  // If no attachments or model doesn't support vision, return simple text message
  if (!attachments || attachments.length === 0 || !modelSupportsVision) {
    return {
      role,
      content,
    };
  }

  // Build multimodal content array
  const contentArray: ChatMessageContent[] = [
    {
      type: 'text',
      text: content,
    },
  ];

  // Add image attachments
  for (const attachment of attachments) {
    contentArray.push({
      type: 'image_url',
      image_url: {
        url: `data:${attachment.mimeType};base64,${attachment.data}`,
      },
    });
  }

  return {
    role,
    content: contentArray,
  };
}

/**
 * Get the current model name from settings based on active provider
 */
export function getCurrentModel(): string {
  const settings = storageService.getSettings();

  // Return provider-specific model
  if (settings.provider === 'anthropic') {
    return settings.anthropicModel || settings.model || 'claude-3-5-sonnet-20241022';
  } else if (settings.provider === 'openai') {
    return settings.openaiModel || settings.model || 'gpt-4o';
  } else if (settings.provider === 'openai-compatible') {
    return settings.openaiCompatibleModel || settings.model || 'gpt-4o';
  } else if (settings.provider === 'vscode-lm') {
    return settings.vscodeLmModel || settings.model || 'gpt-4o';
  } else if (settings.provider === 'qwen-code') {
    return settings.qwenCodeModel || settings.model || 'qwen3-coder-plus';
  } else if (settings.provider === 'zai') {
    return settings.zaiModel || settings.model || 'glm-4.7';
  }

  return settings.model || 'gpt-4o';
}
