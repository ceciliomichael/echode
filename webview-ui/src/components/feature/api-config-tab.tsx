import { ModelDropdown } from '../ui/model-dropdown';
import { ApiKeyInput } from '../ui/api-key-input';
import { ProviderDropdown } from '../ui/provider-dropdown';
import { PROVIDER_DEFAULTS, type Provider } from '../../types/api-settings';

interface ApiConfigTabProps {
  provider: Provider;
  customBaseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  models: string[];
  loadingModels: boolean;
  onProviderChange: (value: Provider) => void;
  onCustomBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onMaxTokensChange: (value: number) => void;
  onTemperatureChange: (value: number) => void;
  onModelDropdownOpen?: () => void;
  onRefreshModels?: () => void;
}

export function ApiConfigTab({
  provider,
  customBaseUrl,
  apiKey,
  model,
  maxTokens,
  temperature,
  models,
  loadingModels,
  onProviderChange,
  onCustomBaseUrlChange,
  onApiKeyChange,
  onModelChange,
  onMaxTokensChange,
  onTemperatureChange,
  onModelDropdownOpen,
  onRefreshModels
}: ApiConfigTabProps) {
  return (
    <div className="max-w-2xl space-y-6">
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
            placeholder={PROVIDER_DEFAULTS[provider].baseUrl}
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

      <div className="space-y-4">
        <h2 
          className="text-sm font-bold pb-2 border-b"
          style={{ 
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)'
          }}
        >
          Model Configuration
        </h2>

        <div className="space-y-2">
          <label
            htmlFor="model"
            className="block text-xs font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Model Name {loadingModels && <span className="text-xs font-normal opacity-60">(Loading...)</span>}
          </label>
          <ModelDropdown
            value={model}
            onChange={onModelChange}
            models={models.length > 0 ? models : [model].filter(Boolean)}
            disabled={loadingModels}
            onOpen={onModelDropdownOpen}
            onRefresh={onRefreshModels}
            isRefreshing={loadingModels}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 
          className="text-sm font-bold pb-2 border-b"
          style={{ 
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)'
          }}
        >
          Generation Parameters
        </h2>

        <div className="space-y-2">
          <label
            htmlFor="maxTokens"
            className="block text-xs font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Max Tokens (Optional)
          </label>
          <input
            id="maxTokens"
            type="text"
            value={maxTokens === 0 ? '' : maxTokens}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d+$/.test(value)) {
                onMaxTokensChange(value === '' ? 0 : Number(value));
              }
            }}
            placeholder="Default: 8192"
            className="w-full px-3 py-2 text-sm rounded-xl border transition-colors"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              borderColor: 'var(--vscode-input-border)'
            }}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="temperature"
            className="block text-xs font-semibold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Temperature (Optional)
          </label>
          <input
            id="temperature"
            type="text"
            value={temperature === 0 ? '' : temperature}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                onTemperatureChange(value === '' ? 0 : Number(value));
              }
            }}
            placeholder="Default: 0"
            className="w-full px-3 py-2 text-sm rounded-xl border transition-colors"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              borderColor: 'var(--vscode-input-border)'
            }}
          />
        </div>
      </div>
    </div>
  );
}
