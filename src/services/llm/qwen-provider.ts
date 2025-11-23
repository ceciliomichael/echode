import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import OpenAI from 'openai';
import { ILLMProvider, ChatMessage, ChatStreamSettings } from './llm-provider.interface';

const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai';
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;
const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56';
const QWEN_DIR = '.qwen';
const QWEN_CREDENTIAL_FILENAME = 'oauth_creds.json';

interface QwenOAuthCredentials {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
  resource_url?: string;
}

function getQwenCachedCredentialPath(customPath?: string): string {
  if (customPath) {
    if (customPath.startsWith('~/')) {
      return path.join(os.homedir(), customPath.slice(2));
    }
    return path.resolve(customPath);
  }
  return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME);
}

function objectToUrlEncoded(data: Record<string, string>): string {
  return Object.keys(data)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
}

export class QwenProvider implements ILLMProvider {
  private credentials: QwenOAuthCredentials | null = null;
  private refreshPromise: Promise<QwenOAuthCredentials> | null = null;
  private client: OpenAI | null = null;

  async streamChat(
    requestId: number,
    messages: ChatMessage[],
    settings: ChatStreamSettings,
    webview: vscode.WebviewView | vscode.WebviewPanel,
    signal: AbortSignal
  ): Promise<void> {
    try {
      await this.ensureAuthenticated(settings);
      
      // Create OpenAI client with Qwen credentials
      if (!this.client) {
        this.client = new OpenAI({
          apiKey: this.credentials!.access_token,
          baseURL: this.getBaseUrl(this.credentials!),
        });
      } else {
        // Update credentials if they changed
        this.client.apiKey = this.credentials!.access_token;
        this.client.baseURL = this.getBaseUrl(this.credentials!);
      }

      const stream = await this.client.chat.completions.create({
        model: settings.model,
        messages: messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content
        })) as OpenAI.ChatCompletionMessageParam[],
        max_tokens: settings.maxTokens,
        temperature: settings.temperature ?? 0.0,
        stream: true,
      });

      // Qwen returns cumulative content, not deltas - track full content to extract only new text
      let fullContent = '';

      for await (const chunk of stream) {
        if (signal.aborted) {
          break;
        }

        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          // Extract only the new text by comparing with previous full content
          let newText = content;
          if (content.startsWith(fullContent)) {
            newText = content.substring(fullContent.length);
          }
          fullContent = content;

          if (newText) {
            webview.webview.postMessage({
              type: 'chatStreamChunk',
              requestId,
              chunk: newText
            });
          }
        }
      }
      
      if (!signal.aborted) {
        webview.webview.postMessage({
          type: 'chatStreamComplete',
          requestId
        });
      }
      
    } catch (error: any) {
      if (signal.aborted) {
        return;
      }
      
      // Handle 401 token expiry
      if (error.status === 401) {
        this.credentials = await this.refreshAccessToken(this.credentials!, settings);
        this.client = null; // Reset client to use new credentials
        return this.streamChat(requestId, messages, settings, webview, signal);
      }
      
      throw new Error(`Qwen API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async loadCachedQwenCredentials(settings: ChatStreamSettings): Promise<QwenOAuthCredentials> {
    try {
      const keyFile = getQwenCachedCredentialPath(settings.qwenCodeOauthPath);
      const credsStr = await fs.readFile(keyFile, 'utf-8');
      return JSON.parse(credsStr);
    } catch (error) {
      throw new Error(`Failed to load Qwen OAuth credentials from ${getQwenCachedCredentialPath(settings.qwenCodeOauthPath)}: ${error}`);
    }
  }

  private async refreshAccessToken(credentials: QwenOAuthCredentials, settings: ChatStreamSettings): Promise<QwenOAuthCredentials> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefreshAccessToken(credentials, settings);

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefreshAccessToken(credentials: QwenOAuthCredentials, settings: ChatStreamSettings): Promise<QwenOAuthCredentials> {
    if (!credentials.refresh_token) {
      throw new Error('No refresh token available in credentials.');
    }

    const bodyData = {
      grant_type: 'refresh_token',
      refresh_token: credentials.refresh_token,
      client_id: QWEN_OAUTH_CLIENT_ID,
    };

    const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: objectToUrlEncoded(bodyData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    const tokenData = await response.json() as any;

    if (tokenData.error) {
      throw new Error(`Token refresh failed: ${tokenData.error} - ${tokenData.error_description}`);
    }

    const newCredentials = {
      ...credentials,
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      refresh_token: tokenData.refresh_token || credentials.refresh_token,
      expiry_date: Date.now() + tokenData.expires_in * 1000,
    };

    const filePath = getQwenCachedCredentialPath(settings.qwenCodeOauthPath);
    try {
      await fs.writeFile(filePath, JSON.stringify(newCredentials, null, 2));
    } catch (error) {
      console.error('Failed to save refreshed credentials:', error);
    }

    return newCredentials;
  }

  private isTokenValid(credentials: QwenOAuthCredentials): boolean {
    const TOKEN_REFRESH_BUFFER_MS = 30 * 1000;
    if (!credentials.expiry_date) {
      return false;
    }
    return Date.now() < credentials.expiry_date - TOKEN_REFRESH_BUFFER_MS;
  }

  private async ensureAuthenticated(settings: ChatStreamSettings): Promise<void> {
    if (!this.credentials) {
      this.credentials = await this.loadCachedQwenCredentials(settings);
    }

    if (!this.isTokenValid(this.credentials)) {
      this.credentials = await this.refreshAccessToken(this.credentials, settings);
    }
  }

  private getBaseUrl(creds: QwenOAuthCredentials): string {
    let baseUrl = creds.resource_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    return baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
  }
}
