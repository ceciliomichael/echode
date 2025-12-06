import * as vscode from 'vscode';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';
import { StreamingTimeoutError } from '../../utils/streaming-timeout';
import { QwenCredentialManager, QwenOAuthCredentials } from './qwen/credential-manager';
import { QwenTokenRefresher } from './qwen/token-refresher';
import { QwenStreamingHandler } from './qwen/streaming-handler';

export class QwenProvider implements ILLMProvider {
  private credentials: QwenOAuthCredentials | null = null;
  private readonly tokenRefresher = new QwenTokenRefresher();
  private readonly streamingHandler = new QwenStreamingHandler();

  async streamChat(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
  ): Promise<void> {
    let attempt = 0;

    while (true) {
      if (signal.aborted) {
        return;
      }

      attempt++;
      try {
        await this.executeStreamWithRetry(requestId, messages, settings, webview, signal);
        return; // Success, exit retry loop
      } catch (error: any) {
        if (signal.aborted) {
          return;
        }
        
        // Handle 401 token expiry
        if (error.status === 401) {
          await this.refreshCredentials(settings);
          this.streamingHandler.resetClient();
          continue; // Retry with new credentials
        }
        
        if (error instanceof StreamingTimeoutError) {
          console.log(`[QwenProvider] Streaming timeout, retrying (attempt ${attempt})...`);
          continue; // Retry
        }
        throw error; // Other errors, propagate
      }
    }
  }

  private async executeStreamWithRetry(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
  ): Promise<void> {
    await this.ensureAuthenticated(settings);
    
    const baseUrl = QwenCredentialManager.getBaseUrl(this.credentials!);
    
    await this.streamingHandler.executeStream(
      requestId,
      messages,
      settings,
      webview,
      signal,
      this.credentials!,
      baseUrl
    );
  }

  private async ensureAuthenticated(settings: ChatStreamSettings): Promise<void> {
    if (!this.credentials) {
      this.credentials = await QwenCredentialManager.loadCredentials(settings.qwenCodeOauthPath);
    }

    if (!QwenCredentialManager.isTokenValid(this.credentials)) {
      await this.refreshCredentials(settings);
    }
  }

  private async refreshCredentials(settings: ChatStreamSettings): Promise<void> {
    if (!this.credentials) {
      throw new Error('Cannot refresh credentials: no credentials loaded');
    }
    
    this.credentials = await this.tokenRefresher.refreshAccessToken(
      this.credentials,
      settings.qwenCodeOauthPath
    );
  }
}