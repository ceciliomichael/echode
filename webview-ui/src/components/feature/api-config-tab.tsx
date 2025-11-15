import { ModelDropdown } from '../ui/model-dropdown';
import { ApiKeyInput } from '../ui/api-key-input';

interface ApiConfigTabProps {
  baseUrl: string;
  apiKey: string;
  model: string;
  models: string[];
  loadingModels: boolean;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelChange: (value: string) => void;
}

export function ApiConfigTab({
  baseUrl,
  apiKey,
  model,
  models,
  loadingModels,
  onBaseUrlChange,
  onApiKeyChange,
  onModelChange
}: ApiConfigTabProps) {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="baseUrl"
          className="block text-xs font-semibold"
          style={{ color: 'var(--vscode-foreground)' }}
        >
          Base URL
        </label>
        <input
          id="baseUrl"
          type="text"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder="https://api.example.com/v1"
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
        />
      </div>
    </div>
  );
}
