import type { ImageAttachment } from '../types/chat';
import type { ChatMessage, ChatMessageContent } from '../types/chat-api';

/**
 * Check if a model supports vision/image inputs
 * Note: Always returns true to allow vision on all models
 * If a model doesn't support vision, the API will handle it gracefully
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  console.log('[Vision] Building message:', {
    role,
    hasAttachments: !!attachments && attachments.length > 0,
    attachmentCount: attachments?.length || 0,
    modelSupportsVision
  });

  // If no attachments or model doesn't support vision, return simple text message
  if (!attachments || attachments.length === 0 || !modelSupportsVision) {
    if (attachments && attachments.length > 0 && !modelSupportsVision) {
      console.warn('[Vision] Model does not support vision - images will not be sent');
    }
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
    console.log('[Vision] Adding image:', {
      mimeType: attachment.mimeType,
      size: attachment.size,
      dataLength: attachment.data.length
    });
    contentArray.push({
      type: 'image_url',
      image_url: {
        url: `data:${attachment.mimeType};base64,${attachment.data}`,
      },
    });
  }

  console.log('[Vision] Built multimodal message with', contentArray.length, 'parts');
  return {
    role,
    content: contentArray,
  };
}

/**
 * Get the current model name from settings
 * This is a placeholder - should be replaced with actual settings retrieval
 */
export function getCurrentModel(): string {
  // TODO: Get from actual settings/config
  // For now, return a default that will be overridden by actual implementation
  const state = window.vscode?.getState() as { model?: string } | undefined;
  return state?.model || 'gpt-4o';
}
