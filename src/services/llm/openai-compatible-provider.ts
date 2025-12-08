import * as vscode from 'vscode';
import OpenAI from 'openai';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';
import { StreamingTimeoutError } from '../../utils/streaming-timeout';

const DEFAULT_STREAMING_TIMEOUT = 5000; // 5 seconds

export class OpenAICompatibleProvider implements ILLMProvider {
  async streamChat(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
  ): Promise<void> {
    const timeoutMs = settings.streamingTimeout ?? DEFAULT_STREAMING_TIMEOUT;
    let attempt = 0;

    while (true) {
      if (signal.aborted) {
        return;
      }

      attempt++;
      try {
        await this.executeStream(requestId, messages, settings, webview, signal, timeoutMs);
        return; // Success, exit retry loop
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        if (error instanceof StreamingTimeoutError) {
          console.log(`[OpenAICompatibleProvider] Streaming timeout, retrying (attempt ${attempt})...`);
          continue; // Retry
        }
        throw error; // Other errors, propagate
      }
    }
  }

  private async executeStream(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal,
    timeoutMs: number
  ): Promise<void> {
    // Add /v1 to baseURL for OpenAI-compatible APIs
    const baseURL = `${settings.baseURL}/v1`;
    
    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL,
    });

    // Track stream state to handle late errors gracefully
    let hasReceivedContent = false;
    let hasFinishReason = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Create timeout promise for first chunk
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        if (!hasReceivedContent) {
          reject(new StreamingTimeoutError('No streaming data received within timeout'));
        }
      }, timeoutMs);
    });

    try {
      const stream = await client.chat.completions.create({
        model: settings.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })) as OpenAI.ChatCompletionMessageParam[],
        max_tokens: settings.maxTokens,
        temperature: settings.temperature ?? 0.7,
        stream: true,
      });

      const processStream = async () => {
        for await (const chunk of stream) {
          // Check for abort
          if (signal.aborted) {
            break;
          }
          
          // Check for finish_reason indicating stream completion
          const finishReason = chunk.choices[0]?.finish_reason;
          if (finishReason) {
            hasFinishReason = true;
          }
          
          // Extract content from delta - OpenAI-compatible APIs send deltas, not cumulative
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            // Mark first chunk received and clear timeout
            if (!hasReceivedContent) {
              hasReceivedContent = true;
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
            }
            
            webview.webview.postMessage({
              type: 'chatStreamChunk',
              requestId,
              chunk: content
            });
          }
        }
      };

      // Race between stream processing and timeout
      await Promise.race([
        processStream(),
        timeoutPromise
      ]);

      // Signal completion only if not aborted
      if (!signal.aborted) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
      }
    } catch (error) {
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (signal.aborted) {
        // Stream was aborted, don't throw
        return;
      }

      if (error instanceof StreamingTimeoutError) {
        throw error; // Let retry logic handle this
      }
      
      // If we received content and/or a finish signal, treat late errors as non-fatal
      // Many OpenAI-compatible servers report errors like HTTP 5xx or "terminated" after
      // successfully delivering the streamed content.
      if (hasReceivedContent || hasFinishReason) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
        return;
      }
      
      throw new Error(`OpenAI Compatible API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
