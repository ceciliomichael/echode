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
  models: string[];
  loadingModels: boolean;
  onProviderChange: (value: Provider) => void;
  onCustomBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onMaxTokensChange: (value: number) => void;
  onModelDropdownOpen?: () => void;
  onRefreshModels?: () => void;
}

export function ApiConfigTab({
  provider,
  customBaseUrl,
  apiKey,
  model,
  maxTokens,
  models,
  loadingModels,
  onProviderChange,
  onCustomBaseUrlChange,
  onApiKeyChange,
  onModelChange,
  onMaxTokensChange,
  onModelDropdownOpen,
  onRefreshModels
}: ApiConfigTabProps) {
  return (
    <div className="max-w-2xl space-y-4">
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

      <div className="space-y-2">
        <label
          htmlFor="maxTokens"
          className="block text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Max Tokens
        </label>
        <input
          id="maxTokens"
          type="number"
          value={maxTokens}
          onChange={(e) => onMaxTokensChange(Number(e.target.value))}
          placeholder="2048"
          min="1"
          max="128000"
          className="w-full px-3 py-2 text-sm rounded-xl border transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderColor: 'var(--vscode-input-border)'
          }}
        />
      </div>
    </div>
  );
}
