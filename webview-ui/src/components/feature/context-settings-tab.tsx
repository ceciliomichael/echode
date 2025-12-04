import { Brain } from 'lucide-react';
import type {
  Provider,
  ContextSettings,
} from '../../types/api-settings';
import { SettingsModelSelector } from '../ui/settings-model-selector';

interface ContextSettingsTabProps {
  contextSettings: ContextSettings;
  onChange: (settings: ContextSettings) => void;
}

export function ContextSettingsTab({ contextSettings, onChange }: ContextSettingsTabProps) {
  const handleModelChange = (provider: Provider, model: string) => {
    onChange({ ...contextSettings, provider, model });
  };

  const handleThresholdChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 10 && numValue <= 100) {
      onChange({ ...contextSettings, thresholdPercent: numValue });
    }
  };

  const handleMaxTokensChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1000) {
      onChange({ ...contextSettings, maxContextTokens: numValue });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Brain size={18} style={{ color: 'var(--vscode-foreground)' }} />
          <h2
            className="text-sm font-bold"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            Context Management
          </h2>
        </div>
        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Configure automatic conversation summarization to maintain context quality.
          When enabled, conversations will be summarized when context usage exceeds the threshold.
        </p>
      </div>

      {/* Enable Toggle */}
      <div
        className="p-4 rounded-xl border"
        style={{
          backgroundColor: 'var(--vscode-input-background)',
          borderColor: 'var(--vscode-input-border)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span
              className="text-sm font-medium"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              Enable Auto-Summarization
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              Automatically summarize conversations when context threshold is exceeded
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={contextSettings.enabled}
            onClick={() => onChange({ ...contextSettings, enabled: !contextSettings.enabled })}
            className="relative w-11 h-6 rounded-full transition-colors"
            style={{
              backgroundColor: contextSettings.enabled
                ? 'var(--vscode-button-background)'
                : 'var(--vscode-input-border)',
            }}
          >
            <span
              className="absolute top-1 left-1 w-4 h-4 rounded-full transition-transform bg-white"
              style={{
                transform: contextSettings.enabled ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>
      </div>

      {/* Context Limits */}
      <div
        className="space-y-4 transition-opacity"
        style={{ opacity: contextSettings.enabled ? 1 : 0.5, pointerEvents: contextSettings.enabled ? 'auto' : 'none' }}
      >
        <h3
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          Context Limits
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {/* Max Context Tokens */}
          <div
            className="p-4 rounded-xl border space-y-2"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              borderColor: 'var(--vscode-input-border)',
            }}
          >
            <label
              className="text-xs font-medium"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              Max Context Tokens
            </label>
            <input
              type="number"
              value={contextSettings.maxContextTokens}
              onChange={(e) => handleMaxTokensChange(e.target.value)}
              min={1000}
              step={1000}
              disabled={!contextSettings.enabled}
              className="w-full px-3 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
              }}
            />
            <p
              className="text-xs"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              Maximum tokens for context window
            </p>
          </div>

          {/* Threshold */}
          <div
            className="p-4 rounded-xl border space-y-2"
            style={{
              backgroundColor: 'var(--vscode-input-background)',
              borderColor: 'var(--vscode-input-border)',
            }}
          >
            <label
              className="text-xs font-medium"
              style={{ color: 'var(--vscode-foreground)' }}
            >
              Summarization Threshold (%)
            </label>
            <input
              type="number"
              value={contextSettings.thresholdPercent}
              onChange={(e) => handleThresholdChange(e.target.value)}
              min={10}
              max={100}
              disabled={!contextSettings.enabled}
              className="w-full px-3 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
              }}
            />
            <p
              className="text-xs"
              style={{ color: 'var(--vscode-descriptionForeground)' }}
            >
              Trigger summarization when usage exceeds this %
            </p>
          </div>
        </div>
      </div>

      {/* Summarization Model */}
      <div
        className="space-y-4 transition-opacity"
        style={{ opacity: contextSettings.enabled ? 1 : 0.5, pointerEvents: contextSettings.enabled ? 'auto' : 'none' }}
      >
        <h3
          className="text-sm font-bold pb-2 border-b"
          style={{
            color: 'var(--vscode-foreground)',
            borderColor: 'var(--vscode-panel-border)',
          }}
        >
          Summarization Model
        </h3>

        <SettingsModelSelector
          provider={contextSettings.provider}
          model={contextSettings.model}
          onChange={handleModelChange}
          icon={<Brain size={14} className="flex-shrink-0" />}
          disabled={!contextSettings.enabled}
        />

        <p
          className="text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          Select the model to use for generating conversation summaries.
          A faster, cheaper model is recommended (e.g., Claude Haiku, GPT-4o-mini).
        </p>
      </div>
    </div>
  );
}
