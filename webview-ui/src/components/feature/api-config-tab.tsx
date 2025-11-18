import { ProviderConfigSection } from '../ui/provider-config-section';
import { ModelConfigSection } from '../ui/model-config-section';
import { GenerationParamsSection } from '../ui/generation-params-section';
import type { Provider } from '../../types/api-settings';

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
      <ProviderConfigSection
        provider={provider}
        customBaseUrl={customBaseUrl}
        apiKey={apiKey}
        onProviderChange={onProviderChange}
        onCustomBaseUrlChange={onCustomBaseUrlChange}
        onApiKeyChange={onApiKeyChange}
      />

      <ModelConfigSection
        model={model}
        models={models}
        loadingModels={loadingModels}
        onModelChange={onModelChange}
        onModelDropdownOpen={onModelDropdownOpen}
        onRefreshModels={onRefreshModels}
      />

      <GenerationParamsSection
        maxTokens={maxTokens}
        temperature={temperature}
        onMaxTokensChange={onMaxTokensChange}
        onTemperatureChange={onTemperatureChange}
      />
    </div>
  );
}
