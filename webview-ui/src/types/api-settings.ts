export interface ApiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt?: string;
}

export const DEFAULT_API_SETTINGS: ApiSettings = {
  baseUrl: '',
  apiKey: '',
  model: '',
  systemPrompt: '',
};