import type { Message } from '../../types/chat';
import type { IChatService } from '../base-chat-service';
import { generateCompressionPrompt } from './compression-prompt';
import type { CompressionConfig } from './types';

/**
 * Service dedicated to compressing chat history into a dense summary.
 * Follows the "Sub-Agent" pattern for specialized tasks.
 */
export class CompressionService {
  private chatService: IChatService;

  constructor(chatService: IChatService) {
    this.chatService = chatService;
  }

  /**
   * Compresses the provided message history using the configured AI model.
   */
  public async compressHistory(
    messages: Message[],
    config: CompressionConfig,
    signal?: AbortSignal
  ): Promise<string> {
    // 1. Format the history for the LLM
    const formattedHistory = this.formatMessages(messages);

    // 2. Generate the specialized system prompt
    const prompt = generateCompressionPrompt(formattedHistory);

    // 3. Prepare the request
    const compressionMessages = [
      {
        role: 'user' as const, // We send the prompt as a user message to ensure the model follows it as an instruction
        content: prompt,
      },
    ];

    // 4. Stream the response using the main chat service with config overrides
    const stream = this.chatService.streamChat({
      messages: compressionMessages,
      signal,
      configOverride: {
        apiKey: config.apiKey,
        model: config.model,
        provider: config.provider,
        baseURL: config.baseURL || '',
        maxTokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.3, // Low temperature for factual consistency
        streamingTimeout: 300000, // 5 minutes timeout to prevent premature termination during compression
        chatMode: 'agent', // Use agent mode for better reasoning
      },
    });

    // 5. Aggregate the stream chunks
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return chunks.join('');
  }

  /**
   * Formats chat messages into a linear text representation.
   * Includes tool execution summaries for context.
   */
  private formatMessages(messages: Message[]): string {
    return messages
      .filter((msg) => !msg.hidden)
      .map((msg) => {
        const attachmentNote = msg.attachments && msg.attachments.length > 0
          ? `\n[Image attachments: ${msg.attachments.length} omitted from compression context]`
          : '';

        if (msg.role === 'user') {
          return `User: ${msg.content}${attachmentNote}`;
        } else {
          // For assistant messages, include tool executions summary
          let content = msg.content;
          if (msg.toolExecutions && msg.toolExecutions.size > 0) {
            const toolSummary = Array.from(msg.toolExecutions.values())
              .map((exec) => {
                const result = exec.result 
                  ? (exec.result.success ? 'Success' : `Failed: ${exec.result.error?.slice(0, 100)}...`) 
                  : 'Pending';
                return `[Tool: ${exec.toolName} -> ${result}]`;
              })
              .join(', ');
            content = `${content}\n${toolSummary}`;
          }
          return `Assistant: ${content}${attachmentNote}`;
        }
      })
      .join('\n\n');
  }
}
