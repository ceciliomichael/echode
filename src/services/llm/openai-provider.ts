import * as vscode from 'vscode';
import OpenAI from 'openai';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';

export class OpenAIProvider implements ILLMProvider {
  async streamChat(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
  ): Promise<void> {
    // Add /v1 to baseURL for OpenAI-compatible APIs
    const baseURL = `${settings.baseURL}/v1`;
    
    const client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL,
    });

    // Track stream state to handle late errors gracefully
    let hasReceivedContent = false;

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

      for await (const chunk of stream) {
        // Check for abort
        if (signal.aborted) {
          break;
        }
        
        // Extract content from delta - OpenAI ALWAYS sends deltas, not cumulative
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          hasReceivedContent = true;
          webview.webview.postMessage({
            type: 'chatStreamChunk',
            requestId,
            chunk: content
          });
        }
      }

      // Signal completion only if not aborted
      if (!signal.aborted) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
      }
    } catch (error) {
      if (signal.aborted) {
        // Stream was aborted, don't throw
        return;
      }

      // If we received content, treat late errors as non-fatal so streamed text is preserved
      if (hasReceivedContent) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
        return;
      }

      throw new Error(`OpenAI API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
