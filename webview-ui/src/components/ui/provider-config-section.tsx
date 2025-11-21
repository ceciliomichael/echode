import { ApiKeyInput } from './api-key-input';
import { ProviderDropdown } from './provider-dropdown';
import { getProviderDefaults, type Provider } from '../../types/api-settings';

interface ProviderConfigSectionProps {
  provider: Provider;
  customBaseUrl: string;
  apiKey: string;
  onProviderChange: (value: Provider) => void;
  onCustomBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
}

export function ProviderConfigSection({
  provider,
  customBaseUrl,
  apiKey,
  onProviderChange,
  onCustomBaseUrlChange,
  onApiKeyChange
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

      <ApiKeyInput value={apiKey} onChange={onApiKeyChange} />
    </div>
  );
}
