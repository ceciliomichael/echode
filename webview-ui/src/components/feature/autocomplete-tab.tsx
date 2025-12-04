import { Zap } from 'lucide-react';
import type {
  Provider,
  AutocompleteSettings,
} from '../../types/api-settings';
import { SettingsModelSelector } from '../ui/settings-model-selector';
import { ToggleSwitch } from '../ui/toggle-switch';

interface AutocompleteTabProps {
  autocompleteSettings: AutocompleteSettings;
  onChange: (settings: AutocompleteSettings) => void;
}

export function AutocompleteTab({ autocompleteSettings, onChange }: AutocompleteTabProps) {
  const handleModelChange = (provider: Provider, model: string) => {
    onChange({ ...autocompleteSettings, provider, model });
  };

  const handleToggleEnabled = () => {
    onChange({ ...autocompleteSettings, enabled: !autocompleteSettings.enabled });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Autocomplete Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap size={18} style={{ color: 'var(--vscode-foreground)' }} />
          <h2
            className="text-sm font-bold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Autocomplete
          </h2>
        </div>
        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Get intelligent code suggestions as you type, similar to GitHub Copilot.
          Suggestions appear as ghost text while you code.
        </p>
      </div>

      {/* Enable Toggle */}
      <div
        className="flex items-center justify-between p-3 rounded-xl border"
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          borderColor: 'var(--vscode-input-border)',
        }}
      >
        <div className="flex flex-col gap-1">
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Enable Autocomplete
          </span>
          <span
            className="text-xs"
            style={{ color: 'var(--vscode-descriptionForeground)' }}
          >
            Show inline suggestions while typing
          </span>
        </div>
        <ToggleSwitch
          checked={autocompleteSettings.enabled}
          onChange={handleToggleEnabled}
        />
      </div>

      {/* Model Selector */}
      <div className="space-y-4">
        <h3
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          Model Configuration
        </h3>

        <SettingsModelSelector
          provider={autocompleteSettings.provider}
          model={autocompleteSettings.model}
          onChange={handleModelChange}
          icon={<Zap size={14} className="flex-shrink-0" />}
        />

        {/* Status indicator */}
        {autocompleteSettings.enabled && autocompleteSettings.model && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl"
            style={{
              backgroundColor: 'var(--vscode-inputValidation-infoBackground)',
              borderColor: 'var(--vscode-inputValidation-infoBorder)',
            }}
          >
            <Zap size={14} style={{ color: 'var(--vscode-inputValidation-infoForeground)' }} />
            <span
              className="text-xs"
              style={{ color: 'var(--vscode-inputValidation-infoForeground)' }}
            >
              Autocomplete active with <strong>{autocompleteSettings.model}</strong>
            </span>
          </div>
        )}

        {autocompleteSettings.enabled && !autocompleteSettings.model && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl"
            style={{
              backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
            }}
          >
            <span
              className="text-xs"
              style={{ color: 'var(--vscode-inputValidation-warningForeground)' }}
            >
              Please select a model to enable autocomplete suggestions
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
