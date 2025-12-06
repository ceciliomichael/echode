import { QwenOAuthCredentials, QwenCredentialManager } from './credential-manager';

const QWEN_OAUTH_BASE_URL = 'https://chat.qwen.ai';
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;
const QWEN_OAUTH_CLIENT_ID = 'f0304373b74a44d2b584a3fb70ca9e56';

function objectToUrlEncoded(data: Record<string, string>): string {
  return Object.keys(data)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&');
}

export class QwenTokenRefresher {
  private refreshPromise: Promise<QwenOAuthCredentials> | null = null;

  async refreshAccessToken(
    credentials: QwenOAuthCredentials,
    customPath?: string
  ): Promise<QwenOAuthCredentials> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefreshAccessToken(credentials, customPath);

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefreshAccessToken(
    credentials: QwenOAuthCredentials,
    customPath?: string
  ): Promise<QwenOAuthCredentials> {
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
      throw new Error(
        `Token refresh failed: ${response.status} ${response.statusText}. Response: ${errorText}`
      );
    }

    const tokenData = await response.json() as any;

    if (tokenData.error) {
      throw new Error(`Token refresh failed: ${tokenData.error} - ${tokenData.error_description}`);
    }

    const newCredentials: QwenOAuthCredentials = {
      ...credentials,
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      refresh_token: tokenData.refresh_token || credentials.refresh_token,
      expiry_date: Date.now() + tokenData.expires_in * 1000,
    };

    await QwenCredentialManager.saveCredentials(newCredentials, customPath);

    return newCredentials;
  }
}