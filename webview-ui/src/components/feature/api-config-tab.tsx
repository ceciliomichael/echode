import { ProviderConfigSection } from '../ui/provider-config-section';
import { GenerationParamsSection } from '../ui/generation-params-section';
import type { Provider } from '../../types/api-settings';

interface ApiConfigTabProps {
  provider: Provider;
  customBaseUrl: string;
  apiKey: string;
  qwenCodeOauthPath?: string;
  maxTokens: number;
  temperature: number;
  onProviderChange: (value: Provider) => void;
  onCustomBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onQwenCodeOauthPathChange?: (value: string) => void;
  onMaxTokensChange: (value: number) => void;
  onTemperatureChange: (value: number) => void;
}

export function ApiConfigTab({
  provider,
  customBaseUrl,
  apiKey,
  qwenCodeOauthPath,
  maxTokens,
  temperature,
  onProviderChange,
  onCustomBaseUrlChange,
  onApiKeyChange,
  onQwenCodeOauthPathChange,
  onMaxTokensChange,
  onTemperatureChange
}: ApiConfigTabProps) {
  return (
    <div className="max-w-2xl space-y-6">
      <ProviderConfigSection
        provider={provider}
        customBaseUrl={customBaseUrl}
        apiKey={apiKey}
        qwenCodeOauthPath={qwenCodeOauthPath}
        onProviderChange={onProviderChange}
        onCustomBaseUrlChange={onCustomBaseUrlChange}
        onApiKeyChange={onApiKeyChange}
        onQwenCodeOauthPathChange={onQwenCodeOauthPathChange}
      />

      <GenerationParamsSection
        provider={provider}
        maxTokens={maxTokens}
        temperature={temperature}
        onMaxTokensChange={onMaxTokensChange}
        onTemperatureChange={onTemperatureChange}
      />
    </div>
  );
}
