import * as vscode from 'vscode';
import { LLMFactory } from '../services/llm/llm-factory';
import { ChatMessage, ChatStreamSettings } from '../services/llm/llm-provider.interface';

interface SummarizationRequest {
  requestId: number;
  prompt: string;
  provider: 'anthropic' | 'openai' | 'openai-compatible' | 'megallm' | 'vscode-lm' | 'qwen-code';
  model: string;
  apiKey: string;
  baseURL: string;
}

/**
 * Handle summarization requests from webview
 * This performs a non-streaming LLM call to generate a conversation summary
 */
export async function handleSummarization(
  data: unknown,
  webview: vscode.WebviewView | vscode.WebviewPanel
): Promise<void> {
  const request = data as SummarizationRequest;
  const { requestId, prompt, provider, model, apiKey, baseURL } = request;

  try {
    // Build messages for summarization
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    // Settings for summarization call
    const settings: ChatStreamSettings = {
      provider,
      apiKey,
      model,
      maxTokens: 2000, // Limit summary length
      baseURL,
      temperature: 0.0, // Deterministic for consistency
    };

    // Create a collector for the streamed response
    let summaryContent = '';
    const abortController = new AbortController();

    // Create a temporary webview-like interface to collect streamed chunks
    const collector = {
      webview: {
        postMessage: (message: { type: string; requestId: number; content?: string; error?: string }) => {
          if (message.type === 'chatStreamChunk' && message.content) {
            summaryContent += message.content;
          } else if (message.type === 'chatStreamEnd') {
            // Stream ended, send the complete summary back
            webview.webview.postMessage({
              type: 'summarizationResult',
              requestId,
              summary: summaryContent,
            });
          } else if (message.type === 'chatStreamError') {
            webview.webview.postMessage({
              type: 'summarizationError',
              requestId,
              error: message.error || 'Unknown error during summarization',
            });
          }
        },
      },
    };

    // Use the LLM provider to stream the response
    const llmProvider = LLMFactory.getProvider(provider);
    await llmProvider.streamChat(
      requestId,
      messages,
      settings,
      collector as unknown as vscode.WebviewView,
      abortController.signal
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    webview.webview.postMessage({
      type: 'summarizationError',
      requestId,
      error: `Summarization failed: ${errorMessage}`,
    });
  }
}
