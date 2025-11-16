export interface ApiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  systemPrompt?: string;
}

export const DEFAULT_API_SETTINGS: ApiSettings = {
  baseUrl: '',
  apiKey: '',
  model: '',
  maxTokens: 64000,
  systemPrompt: '',
};