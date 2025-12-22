import { ProviderConfigSection } from '../ui/provider-config-section';
import { GenerationParamsSection } from '../ui/generation-params-section';
import { RequestSettingsSection } from '../ui/request-settings-section';
import { CustomProviderManager } from '../ui/custom-provider-manager';
import type { Provider, CustomProvider, ReasoningEffort } from '../../types/api-settings';

interface ApiConfigTabProps {
  provider: Provider;
  customBaseUrl: string;
  apiKey: string;
  qwenCodeOauthPath?: string;
  openaiCompatibleReasoningEffort?: ReasoningEffort;
  maxTokens: number;
  temperature: number;
  streamingTimeout: number;
  customProviders: CustomProvider[];
  onProviderChange: (value: Provider) => void;
  onCustomBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onQwenCodeOauthPathChange?: (value: string) => void;
  onOpenaiCompatibleReasoningEffortChange?: (value: ReasoningEffort | undefined) => void;
  onMaxTokensChange: (value: number) => void;
  onTemperatureChange: (value: number) => void;
  onStreamingTimeoutChange: (value: number) => void;
  onAddCustomProvider: (provider: CustomProvider) => void;
  onUpdateCustomProvider: (provider: CustomProvider) => void;
  onDeleteCustomProvider: (id: string) => void;
}

export function ApiConfigTab({
  provider,
  customBaseUrl,
  apiKey,
  qwenCodeOauthPath,
  openaiCompatibleReasoningEffort,
  maxTokens,
  temperature,
  streamingTimeout,
  customProviders,
  onProviderChange,
  onCustomBaseUrlChange,
  onApiKeyChange,
  onQwenCodeOauthPathChange,
  onOpenaiCompatibleReasoningEffortChange,
  onMaxTokensChange,
  onTemperatureChange,
  onStreamingTimeoutChange,
  onAddCustomProvider,
  onUpdateCustomProvider,
  onDeleteCustomProvider
}: ApiConfigTabProps) {
  return (
    <div className="max-w-2xl space-y-6">
      <ProviderConfigSection
        provider={provider}
        customBaseUrl={customBaseUrl}
        apiKey={apiKey}
        qwenCodeOauthPath={qwenCodeOauthPath}
        reasoningEffort={openaiCompatibleReasoningEffort}
        customProviders={customProviders}
        onProviderChange={onProviderChange}
        onCustomBaseUrlChange={onCustomBaseUrlChange}
        onApiKeyChange={onApiKeyChange}
        onQwenCodeOauthPathChange={onQwenCodeOauthPathChange}
        onReasoningEffortChange={onOpenaiCompatibleReasoningEffortChange}
      />

      <CustomProviderManager
        customProviders={customProviders}
        onAddProvider={onAddCustomProvider}
        onUpdateProvider={onUpdateCustomProvider}
        onDeleteProvider={onDeleteCustomProvider}
      />

      <GenerationParamsSection
        provider={provider}
        maxTokens={maxTokens}
        temperature={temperature}
        onMaxTokensChange={onMaxTokensChange}
        onTemperatureChange={onTemperatureChange}
      />

      <RequestSettingsSection
        streamingTimeout={streamingTimeout}
        onStreamingTimeoutChange={onStreamingTimeoutChange}
      />
    </div>
  );
}
