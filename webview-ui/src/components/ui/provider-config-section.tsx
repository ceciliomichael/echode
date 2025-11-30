import { ApiKeyInput } from './api-key-input';
import { ProviderDropdown } from './provider-dropdown';
import { getProviderDefaults, type Provider } from '../../types/api-settings';

interface ProviderConfigSectionProps {
  provider: Provider;
  customBaseUrl: string;
  apiKey: string;
  qwenCodeOauthPath?: string;
  onProviderChange: (value: Provider) => void;
  onCustomBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onQwenCodeOauthPathChange?: (value: string) => void;
}

export function ProviderConfigSection({
  provider,
  customBaseUrl,
  apiKey,
  qwenCodeOauthPath,
  onProviderChange,
  onCustomBaseUrlChange,
  onApiKeyChange,
  onQwenCodeOauthPathChange
}: ProviderConfigSectionProps) {
  return (
    <div className="space-y-4">
      <h2 
        className="text-sm font-bold pb-2 border-b"
        style={{ 
          color: 'var(--vscode-foreground)',
          borderColor: 'var(--vscode-panel-border)'
        }}
      >
        Provider Configuration
      </h2>
      
      <div className="space-y-2">
        <label
          className="block text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Provider
        </label>
        <ProviderDropdown value={provider} onChange={onProviderChange} />
      </div>

      {provider !== 'vscode-lm' && provider !== 'qwen-code' && provider !== 'megallm' && (
        <div className="space-y-2">
          <label
            htmlFor="customBaseUrl"
            className="block text-xs font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Custom Base URL (Optional)
          </label>
          <input
            id="customBaseUrl"
            type="text"
            value={customBaseUrl}
            onChange={(e) => onCustomBaseUrlChange(e.target.value)}
            placeholder={getProviderDefaults(provider).baseUrl}
            className="w-full px-3 py-2 text-sm rounded-xl border transition-colors"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              borderColor: 'var(--vscode-input-border)'
            }}
          />
        </div>
      )}

      {provider === 'qwen-code' && (
        <div className="space-y-2">
          <label
            htmlFor="qwenOauthPath"
            className="block text-xs font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            OAuth Credentials Path
          </label>
          <input
            id="qwenOauthPath"
            type="text"
            value={qwenCodeOauthPath || ''}
            onChange={(e) => onQwenCodeOauthPathChange?.(e.target.value)}
            onBlur={(e) => {
              if (!e.target.value || e.target.value.trim() === '') {
                onQwenCodeOauthPathChange?.('~/.qwen/oauth_creds.json');
              }
            }}
            placeholder="~/.qwen/oauth_creds.json"
            className="w-full px-3 py-2 text-sm rounded-xl border transition-colors"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              borderColor: 'var(--vscode-input-border)'
            }}
          />
          <p className="text-xs" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            Path to your Qwen OAuth credentials file. Defaults to ~/.qwen/oauth_creds.json if left empty.
          </p>
          <div className="text-xs mt-2" style={{ color: 'var(--vscode-descriptionForeground)' }}>
            <p className="mb-1">Qwen Code requires authentication through the official Qwen client:</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>Install the official Qwen client</li>
              <li>Authenticate using your account</li>
              <li>OAuth credentials will be stored automatically</li>
            </ol>
            <a 
              href="https://github.com/QwenLM/qwen-code/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 underline"
              style={{ color: 'var(--vscode-textLink-foreground)' }}
            >
              Setup Instructions
            </a>
          </div>
        </div>
      )}

      {provider !== 'vscode-lm' && provider !== 'qwen-code' && (
        <ApiKeyInput value={apiKey} onChange={onApiKeyChange} />
      )}
    </div>
  );
}
