import { Cpu } from 'lucide-react';
import { ToggleSwitch } from '../ui/toggle-switch';
import type {
  Provider,
  IndexingSettings,
} from '../../types/api-settings';
import { SettingsModelSelector } from '../ui/settings-model-selector';

interface IndexingTabProps {
  indexingSettings: IndexingSettings;
  onChange: (settings: IndexingSettings) => void;
}

export function IndexingTab({ indexingSettings, onChange }: IndexingTabProps) {
  const handleModelChange = (provider: Provider, model: string) => {
    onChange({ ...indexingSettings, provider, model });
  };

  const handleToggleEnabled = () => {
    onChange({ ...indexingSettings, enabled: !indexingSettings.enabled });
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Echo Search Toggle */}
      <div className="space-y-4">
        <h2
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          Echo Search
        </h2>
        <div
          className="flex items-center justify-between p-3 rounded-xl border"
          style={{
            backgroundColor: 'var(--vscode-input-background)',
            borderColor: 'var(--vscode-input-border)',
          }}
        >
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              Enable Echo Search
            </p>
            <p
              className="text-xs"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              Sub-agent that searches your codebase for relevant context.
            </p>
          </div>
          <ToggleSwitch
            checked={indexingSettings.enabled}
            onChange={handleToggleEnabled}
          />
        </div>
      </div>

      {/* Sub-agent Model Configuration */}
      <div className={`space-y-4 ${!indexingSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <h2
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          Sub-Agent Model
        </h2>
        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Configure the AI model used by the echo_search sub-agent for code exploration.
          This model will iteratively search your codebase to find relevant context.
        </p>

        {/* Model Selector */}
        <SettingsModelSelector
          provider={indexingSettings.provider}
          model={indexingSettings.model}
          onChange={handleModelChange}
          icon={<Cpu size={14} className="flex-shrink-0" />}
        />
      </div>
    </div>
  );
}
