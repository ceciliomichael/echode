import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const QWEN_DIR = '.qwen';
const QWEN_CREDENTIAL_FILENAME = 'oauth_creds.json';

export interface QwenOAuthCredentials {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
  resource_url?: string;
}

export class QwenCredentialManager {
  private static readonly TOKEN_REFRESH_BUFFER_MS = 30 * 1000;

  static getCredentialPath(customPath?: string): string {
    if (customPath) {
      if (customPath.startsWith('~/')) {
        return path.join(os.homedir(), customPath.slice(2));
      }
      return path.resolve(customPath);
    }
    return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME);
  }

  static async loadCredentials(customPath?: string): Promise<QwenOAuthCredentials> {
    try {
      const keyFile = this.getCredentialPath(customPath);
      const credsStr = await fs.readFile(keyFile, 'utf-8');
      return JSON.parse(credsStr);
    } catch (error) {
      throw new Error(
        `Failed to load Qwen OAuth credentials from ${this.getCredentialPath(customPath)}: ${error}`
      );
    }
  }

  static async saveCredentials(
    credentials: QwenOAuthCredentials,
    customPath?: string
  ): Promise<void> {
    const filePath = this.getCredentialPath(customPath);
    try {
      await fs.writeFile(filePath, JSON.stringify(credentials, null, 2));
    } catch (error) {
      console.error('Failed to save credentials:', error);
      throw error;
    }
  }

  static isTokenValid(credentials: QwenOAuthCredentials): boolean {
    if (!credentials.expiry_date) {
      return false;
    }
    return Date.now() < credentials.expiry_date - this.TOKEN_REFRESH_BUFFER_MS;
  }

  static getBaseUrl(credentials: QwenOAuthCredentials): string {
    let baseUrl = credentials.resource_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    return baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;
  }
}